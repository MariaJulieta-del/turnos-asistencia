import { describe, expect, it } from "vitest";
import type { EmployeeSnapshot, MonthSchedule, ScheduledShift, Snapshot } from "@turnos/contract";
import { buildApp } from "../src/app";
import { memoryStore } from "../src/memoryStore";
import { monthRange, tzOffsetMinutes } from "../src/period";
import { demoData } from "../src/seed";

const NOW = Date.UTC(2026, 9, 30, 15, 0); // 30/10/2026 12:00 en Argentina

function setup() {
  const store = memoryStore(demoData());
  const app = buildApp({ store, now: () => NOW });
  const get = (url: string, token?: string) =>
    app.inject({ method: "GET", url, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const post = (payload: object, token = "ana") =>
    app.inject({ method: "POST", url: "/punches", payload, headers: { authorization: `Bearer ${token}` } });
  return { store, app, get, post };
}

describe("period", () => {
  it("lee el offset de la zona del comercio", () => {
    expect(tzOffsetMinutes("America/Argentina/Cordoba", NOW)).toBe(-180);
    expect(tzOffsetMinutes("UTC", NOW)).toBe(0);
  });

  it("el mes empieza a las 00:00 local", () => {
    const r = monthRange("2026-10", -180);
    expect(new Date(r.from).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(new Date(r.to).toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("auth", () => {
  it("sin token o con token inválido: 401", async () => {
    const { get } = setup();
    expect((await get("/me/snapshot")).statusCode).toBe(401);
    expect((await get("/me/snapshot", "nope")).statusCode).toBe(401);
  });

  it("un empleado no entra al panel del dueño", async () => {
    const { get } = setup();
    expect((await get("/owner/snapshot", "ana")).statusCode).toBe(403);
    expect((await get("/owner/snapshot", "dueno")).statusCode).toBe(200);
  });
});

describe("GET /me/snapshot", () => {
  it("el empleado recibe solo sus datos y turnos publicados del mes actual", async () => {
    const { get } = setup();
    const s = (await get("/me/snapshot", "ana")).json<EmployeeSnapshot>();
    expect(s.month).toBe("2026-10");
    expect(s.me).toEqual({ id: "e1", name: "Ana López" });
    expect(s.employees).toEqual([s.me]);
    expect(new Set(s.punches.map((p) => p.employeeId))).toEqual(new Set(["e1"]));
    expect(s.planned).toHaveLength(4); // el borrador del 31 no se ve
    expect(s.business.tzOffsetMinutes).toBe(-180);
  });

  it("filtra por mes", async () => {
    const { get } = setup();
    const s = (await get("/me/snapshot?month=2026-09", "ana")).json<Snapshot>();
    expect(s.punches).toEqual([]);
    expect((await get("/me/snapshot?month=2026-13", "ana")).statusCode).toBe(400);
  });
});

describe("GET /owner/snapshot", () => {
  it("el dueño ve a todo el equipo", async () => {
    const { get } = setup();
    const s = (await get("/owner/snapshot", "dueno")).json<Snapshot>();
    expect(s.employees.map((e) => e.id)).toEqual(["o1", "e1", "e2"]);
    expect(s.punches).toHaveLength(10);
  });
});

describe("POST /punches", () => {
  const punch = { id: "uuid-1", employeeId: "e1", type: "OUT", at: NOW - 60_000 };

  it("guarda una marca y el reintento no la duplica", async () => {
    const { post, store } = setup();
    const first = await post(punch);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toEqual({ status: "created", receivedAt: NOW });
    const retry = await post(punch);
    expect(retry.statusCode).toBe(200);
    expect(retry.json().status).toBe("duplicate");
    expect(store.data.punches.filter((p) => p.id === "uuid-1")).toHaveLength(1);
  });

  it("no se puede fichar por otra persona", async () => {
    const { post } = setup();
    expect((await post({ ...punch, employeeId: "e2" })).statusCode).toBe(403);
  });

  it("un id ya usado por otra persona es conflicto y no pisa la marca", async () => {
    const { post, store } = setup();
    await post(punch);
    const res = await post({ ...punch, employeeId: "e2" }, "bruno");
    expect(res.statusCode).toBe(409);
    expect(store.data.punches.find((p) => p.id === "uuid-1")?.employeeId).toBe("e1");
  });

  it("rechaza cuerpos mal formados", async () => {
    const { post } = setup();
    expect((await post({ ...punch, type: "LUNCH" })).statusCode).toBe(400);
    expect((await post({ ...punch, at: "ayer" })).statusCode).toBe(400);
    expect((await post({ ...punch, extra: 1 })).statusCode).toBe(400);
  });

  it("la marca aparece en el registro que ven el empleado y el dueño", async () => {
    const { post, get } = setup();
    await post(punch);
    const mine = (await get("/me/snapshot", "ana")).json<Snapshot>();
    const owner = (await get("/owner/snapshot", "dueno")).json<Snapshot>();
    expect(mine.punches.some((p) => p.id === "uuid-1")).toBe(true);
    expect(owner.punches.filter((p) => p.employeeId === "e1")).toEqual(mine.punches);
  });
});

describe("horarios", () => {
  const send = (app: ReturnType<typeof setup>["app"], method: "POST" | "DELETE", url: string, payload?: object, token = "dueno") =>
    app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } });

  it("el calendario del mes trae turnos, marcas y plantillas de toda la grilla", async () => {
    const { get } = setup();
    const m = (await get("/owner/schedule", "dueno")).json<MonthSchedule>();
    expect(m.month).toBe("2026-10");
    expect(m.dates[0]).toBe("2026-09-28");
    expect(m.dates).toHaveLength(35);
    expect(m.templates.map((t) => t.name)).toEqual(["Mañana", "Tarde", "Cierre"]);
    expect(m.shifts).toHaveLength(8); // 7 publicados + el borrador del 31
    expect(m.shifts.filter((s) => s.status === "DRAFT")).toHaveLength(1);
    expect(m.punches).toHaveLength(10);
  });

  it("solo el dueño ve y edita horarios", async () => {
    const { get, app } = setup();
    expect((await get("/owner/schedule", "ana")).statusCode).toBe(403);
    const res = await send(app, "POST", "/owner/shifts", { employeeId: "e1", date: "2026-11-02", startMin: 540, endMin: 1020 }, "ana");
    expect(res.statusCode).toBe(403);
  });

  it("asigna un turno en borrador; el empleado lo ve recién al publicar", async () => {
    const { get, app } = setup();
    const res = await send(app, "POST", "/owner/shifts", { employeeId: "e2", date: "2026-11-02", startMin: 17 * 60, endMin: 60 });
    expect(res.statusCode).toBe(201);
    const shift = res.json<ScheduledShift>();
    expect(shift.status).toBe("DRAFT");
    expect(new Date(shift.start).toISOString()).toBe("2026-11-02T20:00:00.000Z");
    expect(new Date(shift.end).toISOString()).toBe("2026-11-03T04:00:00.000Z");

    const before = (await get("/me/snapshot?month=2026-11", "bruno")).json<Snapshot>();
    expect(before.planned).toEqual([]);

    // Publicar otro rango no lo toca.
    expect((await send(app, "POST", "/owner/schedule/publish", { from: "2026-11-03", to: "2026-11-30" })).json()).toEqual({
      published: 0,
    });
    const pub = await send(app, "POST", "/owner/schedule/publish", { from: "2026-11-01", to: "2026-11-02" });
    expect(pub.json()).toEqual({ published: 1 });
    expect((await send(app, "POST", "/owner/schedule/publish", { from: "2026-11-02", to: "2026-11-01" })).statusCode).toBe(400);
    const after = (await get("/me/snapshot?month=2026-11", "bruno")).json<Snapshot>();
    expect(after.planned.map((s) => s.id)).toEqual([shift.id]);
  });

  it("no asigna a alguien de otro comercio ni horarios inválidos", async () => {
    const { app } = setup();
    const base = { employeeId: "e1", date: "2026-11-02", startMin: 540, endMin: 1020 };
    expect((await send(app, "POST", "/owner/shifts", { ...base, employeeId: "x9" })).statusCode).toBe(400);
    expect((await send(app, "POST", "/owner/shifts", { ...base, endMin: 1440 })).statusCode).toBe(400);
    expect((await send(app, "POST", "/owner/shifts", { ...base, date: "2/11" })).statusCode).toBe(400);
  });

  it("quitar un borrador lo borra; quitar uno publicado lo cancela", async () => {
    const { app, store } = setup();
    expect((await send(app, "DELETE", "/owner/shifts/shift-e1-2026-10-31")).json()).toEqual({ status: "deleted" });
    expect((await send(app, "DELETE", "/owner/shifts/shift-e1-2026-10-26")).json()).toEqual({ status: "cancelled" });
    expect(store.data.shifts.find((s) => s.id === "shift-e1-2026-10-26")?.status).toBe("CANCELLED");
    expect((await send(app, "DELETE", "/owner/shifts/shift-e1-2026-10-26")).statusCode).toBe(404);
  });
});
