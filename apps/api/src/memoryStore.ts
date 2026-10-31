import type { PlannedShift, Punch } from "@turnos/core";
import type { AuthUser, BusinessRow, InsertResult, Range, Store } from "./store";

export interface MemoryData {
  businesses: BusinessRow[];
  users: (AuthUser & { tokenHash?: string; active: boolean })[];
  holidays: { businessId: string; date: string }[];
  shifts: (PlannedShift & { status: "DRAFT" | "PUBLISHED" | "CANCELLED" })[];
  punches: (Punch & { receivedAt: number })[];
}

/** Store en memoria para tests y para correr la API sin Postgres. No persiste nada. */
export function memoryStore(data: MemoryData): Store & { data: MemoryData } {
  const userIds = (businessId: string) =>
    new Set(data.users.filter((u) => u.businessId === businessId).map((u) => u.id));
  const inRange = (t: number, r: Range) => t >= r.from && t < r.to;
  const byStart = <T extends { start: number }>(a: T, b: T) => a.start - b.start;

  return {
    data,
    async findUserByTokenHash(hash) {
      const u = data.users.find((x) => x.tokenHash === hash && x.active);
      return u ? { id: u.id, businessId: u.businessId, name: u.name, role: u.role } : null;
    },
    async getBusiness(id) {
      return data.businesses.find((b) => b.id === id) ?? null;
    },
    async listHolidays(businessId, month) {
      return data.holidays.filter((h) => h.businessId === businessId && h.date.startsWith(`${month}-`)).map((h) => h.date);
    },
    async listActiveUsers(businessId) {
      return data.users.filter((u) => u.businessId === businessId && u.active).map((u) => ({ id: u.id, name: u.name }));
    },
    async listPunches(businessId, range, userId) {
      const ids = userIds(businessId);
      return data.punches
        .filter((p) => ids.has(p.employeeId) && (!userId || p.employeeId === userId) && inRange(p.at, range))
        .sort((a, b) => a.at - b.at)
        .map(({ id, employeeId, type, at }) => ({ id, employeeId, type, at }));
    },
    async listPublishedShifts(businessId, range, userId) {
      const ids = userIds(businessId);
      return data.shifts
        .filter(
          (s) =>
            s.status === "PUBLISHED" && ids.has(s.employeeId) && (!userId || s.employeeId === userId) && inRange(s.start, range),
        )
        .sort(byStart)
        .map(({ id, employeeId, start, end }) => ({ id, employeeId, start, end }));
    },
    async insertPunch(punch, receivedAt): Promise<InsertResult> {
      const existing = data.punches.find((p) => p.id === punch.id);
      if (existing) return existing.employeeId === punch.employeeId ? "duplicate" : "conflict";
      data.punches.push({ ...punch, receivedAt });
      return "created";
    },
  };
}
