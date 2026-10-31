import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { EmployeeSnapshot, PunchAck, PunchInput, Snapshot } from "@turnos/contract";
import { requireRole } from "./auth";
import { currentMonth, monthRange, tzOffsetMinutes } from "./period";
import type { AuthUser, Store } from "./store";

export interface AppOptions {
  store: Store;
  /** Origen de apps/web para CORS. */
  webOrigin?: string | string[];
  now?: () => number;
  logger?: boolean;
}

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
  },
} as const;

/**
 * API fina: autentica, valida, lee/guarda. No calcula horas; eso lo hace el cliente con @turnos/core
 * sobre los mismos datos, así dueño y empleado ven lo mismo.
 */
export function buildApp({ store, webOrigin = "http://localhost:5173", now = Date.now, logger = false }: AppOptions) {
  // removeAdditional: false -> un campo desconocido es 400, no se descarta en silencio.
  const app: FastifyInstance = Fastify({ logger, ajv: { customOptions: { removeAdditional: false } } });
  app.register(cors, { origin: webOrigin });
  app.decorateRequest("user", null);

  const anyUser = requireRole(store, ["OWNER", "MANAGER", "EMPLOYEE"]);
  const managers = requireRole(store, ["OWNER", "MANAGER"]);

  /** Arma el snapshot del mes. Con `onlyUser`, solo los datos de esa persona. */
  async function snapshot(user: AuthUser, month: string | undefined, onlyUser: boolean): Promise<Snapshot> {
    const business = await store.getBusiness(user.businessId);
    if (!business) throw new Error(`Comercio ${user.businessId} inexistente`);
    const offset = tzOffsetMinutes(business.timezone, now());
    const m = month ?? currentMonth(now(), offset);
    const range = monthRange(m, offset);
    const userId = onlyUser ? user.id : undefined;

    const [holidays, employees, punches, planned] = await Promise.all([
      store.listHolidays(business.id, m),
      onlyUser ? Promise.resolve([{ id: user.id, name: user.name }]) : store.listActiveUsers(business.id),
      store.listPunches(business.id, range, userId),
      store.listPublishedShifts(business.id, range, userId),
    ]);

    return {
      month: m,
      business: {
        tzOffsetMinutes: offset,
        nightStartMin: business.nightStartMin,
        nightEndMin: business.nightEndMin,
        dailyNormalMin: business.dailyNormalMin,
        minRestMin: business.minRestMin,
        graceMin: business.graceMin,
        holidays,
      },
      employees,
      punches,
      planned,
    };
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
      const result = await store.insertPunch(req.body, receivedAt);
      if (result === "conflict") return reply.code(409).send({ error: "Id de marca usado por otra persona" });
      return reply.code(result === "created" ? 201 : 200).send({ status: result, receivedAt });
    },
  );

  return app;
}
