import { describe, expect, it } from "vitest";
import type { EmployeeSnapshot, Snapshot } from "@turnos/contract";
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
