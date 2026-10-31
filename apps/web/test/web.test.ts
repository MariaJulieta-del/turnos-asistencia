import { describe, expect, it } from "vitest";
import type { Punch } from "@turnos/core";
import { memoryStore, newPunch, PunchQueue } from "../src/lib/punchQueue";
import { buildCalendar } from "../src/lib/calendar";
import { summarize, teamTotals } from "../src/lib/summary";
import { buildTimesheet, checkSchedule, nextPunchType } from "../src/lib/timesheet";
import { demoCreateShifts, demoSnapshot } from "../src/demo";

const DEMO_SNAPSHOT = demoSnapshot();

let n = 0;
const id = () => `p${++n}`;

describe("PunchQueue", () => {
  it("no duplica una marca encolada dos veces", async () => {
    const q = new PunchQueue(memoryStore());
    const p = newPunch("e1", "IN", 1000, id);
    await q.enqueue(p);
    await q.enqueue({ ...p });
    expect(await q.pending()).toHaveLength(1);
  });

  it("si no hay señal, las marcas quedan guardadas", async () => {
    const q = new PunchQueue(memoryStore());
    await q.enqueue(newPunch("e1", "IN", 1000, id));
    const r = await q.flush(() => Promise.reject(new Error("offline")));
    expect(r).toEqual({ sent: 0, remaining: 1 });
  });

  it("saca de la cola solo lo que el servidor confirmó, en orden", async () => {
    const q = new PunchQueue(memoryStore());
    const a = newPunch("e1", "IN", 1000, id);
    const b = newPunch("e1", "OUT", 2000, id);
    await q.enqueue(a);
    await q.enqueue(b);
    const sent: string[] = [];
    const r = await q.flush(async (p) => {
      if (p.id === b.id) throw new Error("offline");
      sent.push(p.id);
    });
    expect(sent).toEqual([a.id]);
    expect(r).toEqual({ sent: 1, remaining: 1 });
    expect((await q.pending()).map((p) => p.id)).toEqual([b.id]);
  });

  it("no pierde una marca hecha mientras se envían otras", async () => {
    const q = new PunchQueue(memoryStore());
    await q.enqueue(newPunch("e1", "IN", 1000, id));
    const late = newPunch("e1", "OUT", 2000, id);
    await q.flush(async () => {
      await q.enqueue(late);
    });
    expect((await q.pending()).map((p) => p.id)).toContain(late.id);
  });
});

describe("timesheet", () => {
  const { punches, planned, business } = DEMO_SNAPSHOT;

  it("dueño y empleado obtienen el mismo registro", () => {
    const own = punches.filter((p) => p.employeeId === "e1");
    expect(buildTimesheet("e1", own, planned, business)).toEqual(buildTimesheet("e1", punches, planned, business));
  });

  it("calcula horas y reporta la entrada sin salida sin inventar horas", () => {
    const s = buildTimesheet("e1", punches, planned, business);
    // 08:03 + 07:40 + 10:00 (2 h extra); la entrada del 29 sin salida no suma.
    expect(s.hours.total.total).toBe(483 + 460 + 600);
    expect(s.hours.total.extra).toBe(3 + 120);
    expect(s.anomalies.map((a) => a.kind)).toEqual(["OPEN_IN"]);
    // El 29 queda ABSENT: core solo cuenta intervalos cerrados, la entrada abierta va como anomalía.
    expect(s.attendance.map((a) => a.status)).toEqual(["ON_TIME", "LATE", "ON_TIME", "ABSENT"]);
  });

  it("un turno que todavía no terminó no figura como ausente", () => {
    const shift = { id: "s", employeeId: "e1", start: 1_000_000, end: 2_000_000 };
    expect(buildTimesheet("e1", [], [shift], business, 1_500_000).attendance).toEqual([]);
    expect(buildTimesheet("e1", [], [shift], business, 2_000_000).attendance.map((a) => a.status)).toEqual(["ABSENT"]);
  });

  it("una marca pendiente que el servidor ya tiene no se cuenta dos veces", () => {
    const dup: Punch = { ...punches[0]! };
    const s = buildTimesheet("e1", [...punches, dup], planned, business);
    expect(s.hours.total.total).toBe(483 + 460 + 600);
  });

  it("avisa turnos superpuestos y poco descanso, pero no el horario cortado", () => {
    const h = 3_600_000;
    const w = checkSchedule(
      [
        { id: "a", employeeId: "e1", start: 14 * h, end: 22 * h }, // día 1
        { id: "b", employeeId: "e1", start: 21 * h, end: 23 * h }, // se superpone con a
        { id: "c", employeeId: "e1", start: 30 * h, end: 34 * h }, // día 2 06–10: 7 h de descanso
        { id: "d", employeeId: "e1", start: 38 * h, end: 42 * h }, // día 2 14–18: cortado, no avisa
        { id: "e", employeeId: "e2", start: 30 * h, end: 34 * h },
      ],
      720,
      0,
    );
    expect(w.map((x) => x.kind)).toEqual(["overlap", "short_rest"]);
  });

  it("el calendario junta horario cortado, lo marcado y las horas extra del día", () => {
    const snap = demoSnapshot();
    const shifts = snap.planned.map((s) => ({ ...s, status: "PUBLISHED" as const }));
    const cal = buildCalendar(snap.employees, shifts, snap.punches, snap.business);
    const ana28 = cal.get("2026-10-28")?.find((e) => e.employeeId === "e1");
    expect(ana28?.plannedMin).toBe(480);
    expect(ana28?.workedMin).toBe(600);
    expect(ana28?.extraMin).toBe(120);
    // El 29 tiene turno pero la salida no se marcó: queda la anomalía en ese día.
    expect(cal.get("2026-10-29")?.find((e) => e.employeeId === "e1")?.anomalies.map((a) => a.kind)).toEqual(["OPEN_IN"]);
  });

  it("marcas fuera del local o sin ubicación quedan para revisar, pero suman horas", () => {
    const s = buildTimesheet("e1", punches, planned, business);
    expect(s.locationFlags.map((f) => f.geo.status)).toEqual(["OUTSIDE"]);
    // La entrada del 27 fuera del local cuenta igual: 7 h 40 min ese día.
    expect(s.hours.byDay["2026-10-27"]?.total).toBe(460);
    expect(buildTimesheet("e2", punches, planned, business).locationFlags.map((f) => f.geo.status)).toEqual(["NONE"]);
  });

  it("asignar el mismo horario cortado en varios días crea un turno por tramo y día", () => {
    const created = demoCreateShifts({
      employeeId: "e2",
      dates: ["2026-11-04", "2026-11-03"],
      segments: [
        { startMin: 540, endMin: 780 },
        { startMin: 1020, endMin: 1260 },
      ],
    });
    expect(created).toHaveLength(4);
    expect(new Set(created.map((c) => c.status))).toEqual(new Set(["DRAFT"]));
    expect(created[0]!.start).toBeLessThan(created[2]!.start); // ordenados por día
  });

  it("el recuento por empleado junta horas, extra, asistencia y lo pendiente", () => {
    // "Ahora" = 30/10 12:00 en Argentina: el turno de Bruno de ese día todavía no terminó.
    const now = Date.UTC(2026, 9, 30, 15, 0);
    const ana = summarize(buildTimesheet("e1", punches, planned, business, now), planned, now);
    expect(ana).toMatchObject({
      workedMin: 483 + 460 + 600,
      extraMin: 123,
      shifts: 4,
      plannedMin: 4 * 480,
      plannedPastMin: 4 * 480,
      onTime: 2,
      late: 1,
      lateMin: 20,
      absent: 1,
      toReview: 2, // entrada sin salida + entrada fuera del local
    });
    const bruno = summarize(buildTimesheet("e2", punches, planned, business, now), planned, now);
    expect(bruno.upcomingShifts.map((s) => s.id)).toEqual(["shift-e2-2026-10-30"]);
    expect(teamTotals([ana, bruno]).workedMin).toBe(ana.workedMin + bruno.workedMin);
  });

  it("propone salida si la última marca es una entrada", () => {
    expect(nextPunchType(punches, "e1")).toBe("OUT");
    expect(nextPunchType(punches, "e2")).toBe("IN");
    expect(nextPunchType([], "e1")).toBe("IN");
  });
});
