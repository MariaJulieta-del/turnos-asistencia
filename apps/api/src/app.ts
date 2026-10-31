import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type {
  BusinessRules,
  EmployeeSnapshot,
  MonthSchedule,
  NewShiftsInput,
  PublishInput,
  PublishResult,
  PunchAck,
  PunchGeo,
  PunchInput,
  ScheduledShift,
  Snapshot,
  Workplace,
  WorkplaceInput,
} from "@turnos/contract";
import { addDays, checkGeofence, monthGridDates, shiftInstants } from "@turnos/core";
import { requireRole } from "./auth";
import { currentMonth, monthRange, tzOffsetMinutes } from "./period";
import type { AuthUser, BusinessRow, Range, Store } from "./store";

export interface AppOptions {
  store: Store;
  /** Origen de apps/web para CORS. */
  webOrigin?: string | string[];
  now?: () => number;
  logger?: boolean;
}

const DATE = "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$";

const monthQuery = {
  type: "object",
  properties: { month: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } },
  additionalProperties: false,
} as const;

const punchBody = {
  type: "object",
  required: ["id", "employeeId", "type", "at"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1, maxLength: 100 },
    employeeId: { type: "string", minLength: 1 },
    type: { enum: ["IN", "OUT"] },
    at: { type: "integer", minimum: 0 },
    location: {
      type: "object",
      required: ["lat", "lng", "accuracyM"],
      additionalProperties: false,
      properties: {
        lat: { type: "number", minimum: -90, maximum: 90 },
        lng: { type: "number", minimum: -180, maximum: 180 },
        accuracyM: { type: "number", minimum: 0, maximum: 100_000 },
      },
    },
  },
} as const;

const minuteOfDay = { type: "integer", minimum: 0, maximum: 1439 } as const;

const shiftsBody = {
  type: "object",
  required: ["employeeId", "dates", "segments"],
  additionalProperties: false,
  properties: {
    employeeId: { type: "string", minLength: 1 },
    // Hasta dos meses de una vez; sin repetir días.
    dates: { type: "array", minItems: 1, maxItems: 62, uniqueItems: true, items: { type: "string", pattern: DATE } },
    // Uno (de corrido) o dos tramos (cortado).
    segments: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        required: ["startMin", "endMin"],
        additionalProperties: false,
        properties: { startMin: minuteOfDay, endMin: minuteOfDay },
      },
    },
  },
} as const;

const workplaceBody = {
  type: "object",
  required: ["name", "lat", "lng", "radiusM"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    lat: { type: "number", minimum: -90, maximum: 90 },
    lng: { type: "number", minimum: -180, maximum: 180 },
    // Menos de 30 m el GPS no alcanza a distinguir; más de 2 km deja de servir como control.
    radiusM: { type: "integer", minimum: 30, maximum: 2000 },
  },
} as const;

const publishBody = {
  type: "object",
  required: ["from", "to"],
  additionalProperties: false,
  properties: { from: { type: "string", pattern: DATE }, to: { type: "string", pattern: DATE } },
} as const;

/**
 * API fina: autentica, valida, lee/guarda. No calcula horas; eso lo hace el cliente con @turnos/core
 * sobre los mismos datos, así dueño y empleado ven lo mismo.
 */
export function buildApp({ store, webOrigin = "http://localhost:5173", now = Date.now, logger = false }: AppOptions) {
  // removeAdditional: false -> un campo desconocido es 400, no se descarta en silencio.
  const app: FastifyInstance = Fastify({ logger, ajv: { customOptions: { removeAdditional: false } } });
  app.register(cors, { origin: webOrigin, methods: ["GET", "POST", "PUT", "DELETE"] });
  app.decorateRequest("user", null);

  const anyUser = requireRole(store, ["OWNER", "MANAGER", "EMPLOYEE"]);
  const managers = requireRole(store, ["OWNER", "MANAGER"]);

  async function businessOf(user: AuthUser): Promise<{ business: BusinessRow; offset: number }> {
    const business = await store.getBusiness(user.businessId);
    if (!business) throw new Error(`Comercio ${user.businessId} inexistente`);
    return { business, offset: tzOffsetMinutes(business.timezone, now()) };
  }

  function rules(business: BusinessRow, offset: number, holidays: string[]): BusinessRules {
    return {
      tzOffsetMinutes: offset,
      nightStartMin: business.nightStartMin,
      nightEndMin: business.nightEndMin,
      dailyNormalMin: business.dailyNormalMin,
      minRestMin: business.minRestMin,
      graceMin: business.graceMin,
      holidays,
    };
  }

  /** Instantes desde las 00:00 de `first` hasta las 00:00 del día siguiente a `last` (fechas locales). */
  function datesRange(first: string, last: string, offset: number): Range {
    return {
      from: shiftInstants(first, 0, 1, offset).start,
      to: shiftInstants(addDays(last, 1), 0, 1, offset).start,
    };
  }

  /** Arma el snapshot del mes. Con `onlyUser`, solo los datos de esa persona. */
  async function snapshot(user: AuthUser, month: string | undefined, onlyUser: boolean): Promise<Snapshot> {
    const { business, offset } = await businessOf(user);
    const m = month ?? currentMonth(now(), offset);
    const range = monthRange(m, offset);
    const userId = onlyUser ? user.id : undefined;

    const [holidays, employees, punches, planned, workplaces] = await Promise.all([
      store.listHolidays(business.id, m),
      onlyUser ? Promise.resolve([{ id: user.id, name: user.name }]) : store.listActiveUsers(business.id),
      store.listPunches(business.id, range, userId),
      store.listPublishedShifts(business.id, range, userId),
      store.listWorkplaces(business.id),
    ]);

    return { month: m, business: rules(business, offset, holidays), employees, punches, planned, workplaces };
  }

  /**
   * Resultado de la geovalla para una marca. null si el comercio no tiene local configurado.
   * Las coordenadas se usan acá y se descartan: no llegan al store.
   */
  function geoFor(location: PunchInput["location"], workplaces: Workplace[]): PunchGeo | null {
    if (workplaces.length === 0) return null;
    if (!location) return { status: "NONE" };
    const check = checkGeofence(location, workplaces)!;
    return { status: check.status, distanceM: check.distanceM, accuracyM: Math.round(location.accuracyM) };
  }

  app.get("/health", async () => ({ ok: true }));

  app.get<{ Querystring: { month?: string } }>(
    "/me/snapshot",
    { schema: { querystring: monthQuery }, preHandler: anyUser },
    async (req): Promise<EmployeeSnapshot> => {
      const user = req.user!;
      return { ...(await snapshot(user, req.query.month, true)), me: { id: user.id, name: user.name } };
    },
  );

  app.get<{ Querystring: { month?: string } }>(
    "/owner/snapshot",
    { schema: { querystring: monthQuery }, preHandler: managers },
    async (req): Promise<Snapshot> => snapshot(req.user!, req.query.month, false),
  );

  app.post<{ Body: PunchInput }>(
    "/punches",
    { schema: { body: punchBody }, preHandler: anyUser },
    async (req, reply): Promise<PunchAck | { error: string }> => {
      const user = req.user!;
      // Cada uno ficha por sí mismo. Las correcciones del dueño van por otra ruta (pendiente).
      if (req.body.employeeId !== user.id) return reply.code(403).send({ error: "Solo podés fichar por vos" });
      const receivedAt = now();
      // Nunca se rechaza una marca por la ubicación: queda guardada y marcada para que el dueño revise.
      const { location, ...punch } = req.body;
      const geo = geoFor(location, await store.listWorkplaces(user.businessId));
      const result = await store.insertPunch(punch, receivedAt, geo);
      if (result === "conflict") return reply.code(409).send({ error: "Id de marca usado por otra persona" });
      if (result === "duplicate") return reply.code(200).send({ status: result, receivedAt });
      return reply.code(201).send({ status: result, receivedAt, ...(geo && { geo }) });
    },
  );

  // ---------- Lugar de trabajo ----------

  app.get("/owner/workplace", { preHandler: managers }, async (req): Promise<{ workplace: Workplace | null }> => {
    const [first] = await store.listWorkplaces(req.user!.businessId);
    return { workplace: first ?? null };
  });

  app.put<{ Body: WorkplaceInput }>(
    "/owner/workplace",
    { schema: { body: workplaceBody }, preHandler: managers },
    async (req): Promise<{ workplace: Workplace }> => ({
      workplace: await store.saveWorkplace(req.user!.businessId, req.body),
    }),
  );

  // ---------- Horarios ----------

  /** Calendario del mes: turnos (borradores y publicados) y marcas reales de toda la grilla visible. */
  app.get<{ Querystring: { month?: string } }>(
    "/owner/schedule",
    { schema: { querystring: monthQuery }, preHandler: managers },
    async (req): Promise<MonthSchedule> => {
      const { business, offset } = await businessOf(req.user!);
      const month = req.query.month ?? currentMonth(now(), offset);
      const dates = monthGridDates(month);
      const range = datesRange(dates[0]!, dates.at(-1)!, offset);
      const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
      const [holidayLists, employees, shifts, punches, templates] = await Promise.all([
        Promise.all(months.map((m) => store.listHolidays(business.id, m))),
        store.listActiveUsers(business.id),
        store.listShifts(business.id, range),
        store.listPunches(business.id, range),
        store.listTemplates(business.id),
      ]);
      return {
        month,
        dates,
        business: rules(business, offset, holidayLists.flat()),
        employees,
        shifts,
        punches,
        templates,
      };
    },
  );

  /** El mismo horario (de corrido o cortado) en uno o varios días, como borrador. */
  app.post<{ Body: NewShiftsInput }>(
    "/owner/shifts",
    { schema: { body: shiftsBody }, preHandler: managers },
    async (req, reply): Promise<ScheduledShift[] | { error: string }> => {
      const { business, offset } = await businessOf(req.user!);
      const { employeeId, dates, segments } = req.body;
      const employees = await store.listActiveUsers(business.id);
      if (!employees.some((e) => e.id === employeeId)) {
        return reply.code(400).send({ error: "Ese empleado no es de este comercio" });
      }
      const [first, second] = segments;
      if (second && (first!.endMin <= first!.startMin || second.startMin < first!.endMin)) {
        return reply.code(400).send({ error: "En un horario cortado, el segundo tramo empieza después del primero" });
      }
      const shifts = [...dates]
        .sort()
        .flatMap((date) => segments.map((s) => ({ employeeId, ...shiftInstants(date, s.startMin, s.endMin, offset) })));
      return reply.code(201).send(await store.createShifts(shifts));
    },
  );

  app.delete<{ Params: { id: string } }>("/owner/shifts/:id", { preHandler: managers }, async (req, reply) => {
    const result = await store.removeShift(req.user!.businessId, req.params.id);
    if (result === "not_found") return reply.code(404).send({ error: "Turno inexistente" });
    return { status: result };
  });

  app.post<{ Body: PublishInput }>(
    "/owner/schedule/publish",
    { schema: { body: publishBody }, preHandler: managers },
    async (req, reply): Promise<PublishResult | { error: string }> => {
      const { business, offset } = await businessOf(req.user!);
      if (req.body.to < req.body.from) return reply.code(400).send({ error: "El rango de fechas está invertido" });
      return { published: await store.publishShifts(business.id, datesRange(req.body.from, req.body.to, offset)) };
    },
  );

  return app;
}
