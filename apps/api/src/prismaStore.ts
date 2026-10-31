import { Prisma, type PrismaClient } from "@prisma/client";
import type { InsertResult, Store } from "./store";

/** Store sobre packages/db (Prisma + PostgreSQL). */
export function prismaStore(db: PrismaClient): Store {
  return {
    async findUserByTokenHash(hash) {
      const u = await db.user.findFirst({
        where: { accessTokenHash: hash, active: true },
        select: { id: true, businessId: true, name: true, role: true },
      });
      return u;
    },

    async getBusiness(id) {
      return db.business.findUnique({
        where: { id },
        select: {
          id: true,
          timezone: true,
          nightStartMin: true,
          nightEndMin: true,
          dailyNormalMin: true,
          minRestMin: true,
          graceMin: true,
        },
      });
    },

    async listHolidays(businessId, month) {
      const rows = await db.holiday.findMany({
        where: { businessId, date: { startsWith: `${month}-` } },
        select: { date: true },
        orderBy: { date: "asc" },
      });
      return rows.map((r) => r.date);
    },

    async listActiveUsers(businessId) {
      return db.user.findMany({
        where: { businessId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    },

    async listPunches(businessId, range, userId) {
      const rows = await db.punch.findMany({
        where: {
          user: { businessId },
          ...(userId && { userId }),
          at: { gte: new Date(range.from), lt: new Date(range.to) },
        },
        select: {
          clientEventId: true,
          userId: true,
          type: true,
          at: true,
          geoStatus: true,
          distanceM: true,
          accuracyM: true,
        },
        orderBy: { at: "asc" },
      });
      return rows.map((r) => ({
        id: r.clientEventId,
        employeeId: r.userId,
        type: r.type,
        at: r.at.getTime(),
        ...(r.geoStatus && {
          geo: {
            status: r.geoStatus,
            ...(r.distanceM !== null && { distanceM: r.distanceM }),
            ...(r.accuracyM !== null && { accuracyM: r.accuracyM }),
          },
        }),
      }));
    },

    async listPublishedShifts(businessId, range, userId) {
      const rows = await db.shift.findMany({
        where: {
          user: { businessId },
          ...(userId && { userId }),
          status: "PUBLISHED",
          startsAt: { gte: new Date(range.from), lt: new Date(range.to) },
        },
        select: { id: true, userId: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: "asc" },
      });
      return rows.map((r) => ({ id: r.id, employeeId: r.userId, start: r.startsAt.getTime(), end: r.endsAt.getTime() }));
    },

    async insertPunch(punch, receivedAt, geo): Promise<InsertResult> {
      try {
        await db.punch.create({
          data: {
            clientEventId: punch.id,
            userId: punch.employeeId,
            type: punch.type,
            at: new Date(punch.at),
            receivedAt: new Date(receivedAt),
            geoStatus: geo?.status ?? null,
            distanceM: geo?.distanceM ?? null,
            accuracyM: geo?.accuracyM ?? null,
          },
        });
        return "created";
      } catch (e) {
        // P2002: clientEventId ya existe -> reintento offline (o colisión de id de otra persona).
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") throw e;
        const existing = await db.punch.findUnique({ where: { clientEventId: punch.id }, select: { userId: true } });
        return existing?.userId === punch.employeeId ? "duplicate" : "conflict";
      }
    },

    async listWorkplaces(businessId) {
      const rows = await db.location.findMany({
        where: { businessId, lat: { not: null }, lng: { not: null }, radiusM: { not: null } },
        select: { id: true, name: true, lat: true, lng: true, radiusM: true },
      });
      return rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat!, lng: r.lng!, radiusM: r.radiusM! }));
    },

    async saveWorkplace(businessId, input) {
      const existing = await db.location.findFirst({ where: { businessId }, select: { id: true } });
      const r = existing
        ? await db.location.update({ where: { id: existing.id }, data: input, select: { id: true } })
        : await db.location.create({ data: { businessId, ...input }, select: { id: true } });
      return { id: r.id, ...input };
    },

    async listTemplates(businessId) {
      return db.shiftTemplate.findMany({
        where: { businessId },
        select: { id: true, name: true, startMin: true, endMin: true },
        orderBy: { startMin: "asc" },
      });
    },

    async listShifts(businessId, range) {
      const rows = await db.shift.findMany({
        where: {
          user: { businessId },
          status: { in: ["DRAFT", "PUBLISHED"] },
          startsAt: { gte: new Date(range.from), lt: new Date(range.to) },
        },
        select: { id: true, userId: true, startsAt: true, endsAt: true, status: true },
        orderBy: { startsAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        employeeId: r.userId,
        start: r.startsAt.getTime(),
        end: r.endsAt.getTime(),
        status: r.status as "DRAFT" | "PUBLISHED",
      }));
    },

    async createShifts(shifts) {
      // En una transacción: o se crean todos los días o ninguno.
      const rows = await db.$transaction(
        shifts.map((s) =>
          db.shift.create({
            data: { userId: s.employeeId, startsAt: new Date(s.start), endsAt: new Date(s.end), status: "DRAFT" },
            select: { id: true },
          }),
        ),
      );
      return rows.map((r, i) => ({ id: r.id, ...shifts[i]!, status: "DRAFT" as const }));
    },

    async removeShift(businessId, id) {
      const s = await db.shift.findFirst({ where: { id, user: { businessId } }, select: { status: true } });
      if (!s || s.status === "CANCELLED") return "not_found";
      if (s.status === "DRAFT") {
        await db.shift.delete({ where: { id } });
        return "deleted";
      }
      await db.shift.update({ where: { id }, data: { status: "CANCELLED" } });
      return "cancelled";
    },

    async publishShifts(businessId, range) {
      const r = await db.shift.updateMany({
        where: {
          user: { businessId },
          status: "DRAFT",
          startsAt: { gte: new Date(range.from), lt: new Date(range.to) },
        },
        data: { status: "PUBLISHED" },
      });
      return r.count;
    },
  };
}
