import { describe, expect, it } from "vitest";
import {
  compareToSchedule,
  computeHours,
  defaultRules,
  findRestViolations,
  pairPunches,
  type Interval,
  type Punch,
} from "../src/index";

const OFFSET = -180;
/** Hora local de Argentina -> epoch ms. at("2026-03-02", "09:00") */
const at = (date: string, hhmm: string): number => {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  return Date.UTC(y, mo - 1, d, h, mi) - OFFSET * 60_000;
};
const iv = (start: number, end: number, employeeId = "e1"): Interval => ({ employeeId, start, end });
const punch = (id: string, type: "IN" | "OUT", t: number, employeeId = "e1"): Punch => ({
  id,
  employeeId,
  type,
  at: t,
});

describe("pairPunches", () => {
  it("empareja una entrada y una salida", () => {
    const r = pairPunches([punch("a", "IN", at("2026-03-02", "09:00")), punch("b", "OUT", at("2026-03-02", "17:00"))]);
    expect(r.anomalies).toEqual([]);
    expect(r.intervals).toHaveLength(1);
    expect((r.intervals[0]!.end - r.intervals[0]!.start) / 60_000).toBe(480);
  });

  it("ignora marcas repetidas con el mismo id (reintento offline)", () => {
    const p = punch("a", "IN", at("2026-03-02", "09:00"));
    const r = pairPunches([p, { ...p }, punch("b", "OUT", at("2026-03-02", "17:00"))]);
    expect(r.intervals).toHaveLength(1);
    expect(r.anomalies).toEqual([]);
  });

  it("marca doble entrada, salida huérfana y entrada abierta", () => {
    const r = pairPunches([
      punch("o1", "OUT", at("2026-03-02", "08:00")),
      punch("i1", "IN", at("2026-03-02", "09:00")),
      punch("i2", "IN", at("2026-03-02", "09:05")),
      punch("o2", "OUT", at("2026-03-02", "13:00")),
      punch("i3", "IN", at("2026-03-03", "09:00")),
    ]);
    expect(r.anomalies.map((a) => a.kind)).toEqual(["ORPHAN_OUT", "DOUBLE_IN", "OPEN_IN"]);
    expect(r.intervals).toHaveLength(1);
    expect(r.intervals[0]!.start).toBe(at("2026-03-02", "09:05"));
  });

  it("no mezcla empleados", () => {
    const r = pairPunches([
      punch("a", "IN", at("2026-03-02", "09:00"), "e1"),
      punch("b", "IN", at("2026-03-02", "09:10"), "e2"),
      punch("c", "OUT", at("2026-03-02", "17:00"), "e1"),
      punch("d", "OUT", at("2026-03-02", "17:10"), "e2"),
    ]);
    expect(r.anomalies).toEqual([]);
    expect(r.intervals.map((i) => i.employeeId).sort()).toEqual(["e1", "e2"]);
  });

  it("marca intervalos sospechosamente largos", () => {
    const r = pairPunches([punch("a", "IN", at("2026-03-02", "09:00")), punch("b", "OUT", at("2026-03-03", "09:00"))]);
    expect(r.intervals).toHaveLength(1);
    expect(r.anomalies.map((a) => a.kind)).toEqual(["LONG_INTERVAL"]);
  });
});

describe("computeHours", () => {
  const rules = defaultRules(["2026-05-25"]);

  it("jornada normal de 8 h", () => {
    const { total } = computeHours([iv(at("2026-03-02", "09:00"), at("2026-03-02", "17:00"))], rules);
    expect(total).toEqual({ normal: 480, extra: 0, night: 0, holiday: 0, total: 480 });
  });

  it("2 h extra pasado el tope diario", () => {
    const { total } = computeHours([iv(at("2026-03-02", "09:00"), at("2026-03-02", "19:00"))], rules);
    expect(total).toMatchObject({ normal: 480, extra: 120, night: 0, total: 600 });
  });

  it("turno que cruza a la franja nocturna", () => {
    const { total, byDay } = computeHours([iv(at("2026-03-02", "20:00"), at("2026-03-03", "02:00"))], rules);
    expect(total).toMatchObject({ normal: 60, night: 300, extra: 0, total: 360 });
    expect(Object.keys(byDay)).toEqual(["2026-03-02"]);
  });

  it("nocturno largo: primero nocturno, luego extra", () => {
    const { total } = computeHours([iv(at("2026-03-02", "22:00"), at("2026-03-03", "08:00"))], rules);
    expect(total).toMatchObject({ night: 480, extra: 120, normal: 0, total: 600 });
  });

  it("feriado completo", () => {
    const { total } = computeHours([iv(at("2026-05-25", "09:00"), at("2026-05-25", "17:00"))], rules);
    expect(total).toMatchObject({ holiday: 480, normal: 0, total: 480 });
  });

  it("turno que entra al feriado pasada la medianoche", () => {
    const { total } = computeHours([iv(at("2026-05-24", "22:00"), at("2026-05-25", "02:00"))], rules);
    expect(total).toMatchObject({ night: 120, holiday: 120, total: 240 });
  });

  it("turno cortado: el tope diario se acumula entre intervalos del mismo día", () => {
    const { total } = computeHours(
      [iv(at("2026-03-02", "08:00"), at("2026-03-02", "12:00")), iv(at("2026-03-02", "14:00"), at("2026-03-02", "20:00"))],
      rules,
    );
    expect(total).toMatchObject({ normal: 480, extra: 120, total: 600 });
  });

  it("el total siempre es la suma de las categorías", () => {
    const { total } = computeHours(
      [iv(at("2026-05-24", "18:00"), at("2026-05-25", "09:30")), iv(at("2026-05-26", "07:00"), at("2026-05-26", "23:00"))],
      rules,
    );
    expect(total.normal + total.extra + total.night + total.holiday).toBe(total.total);
  });
});

describe("findRestViolations", () => {
  it("detecta descanso corto", () => {
    const v = findRestViolations([
      iv(at("2026-03-02", "15:00"), at("2026-03-02", "23:00")),
      iv(at("2026-03-03", "08:00"), at("2026-03-03", "16:00")),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]!.restMin).toBe(540);
  });

  it("12 h justas es válido", () => {
    const v = findRestViolations([
      iv(at("2026-03-02", "15:00"), at("2026-03-02", "23:00")),
      iv(at("2026-03-03", "11:00"), at("2026-03-03", "19:00")),
    ]);
    expect(v).toEqual([]);
  });
});

describe("compareToSchedule", () => {
  const shift = { id: "s1", employeeId: "e1", start: at("2026-03-02", "09:00"), end: at("2026-03-02", "17:00") };

  it("puntual dentro de la tolerancia", () => {
    const [r] = compareToSchedule([shift], [iv(at("2026-03-02", "09:03"), at("2026-03-02", "17:00"))]);
    expect(r).toMatchObject({ status: "ON_TIME", lateMin: 3 });
  });

  it("tarde", () => {
    const [r] = compareToSchedule([shift], [iv(at("2026-03-02", "09:20"), at("2026-03-02", "17:00"))]);
    expect(r).toMatchObject({ status: "LATE", lateMin: 20 });
  });

  it("ausente si no hay intervalo", () => {
    const [r] = compareToSchedule([shift], []);
    expect(r).toMatchObject({ status: "ABSENT", lateMin: 0 });
  });

  it("entrar antes no es tardanza", () => {
    const [r] = compareToSchedule([shift], [iv(at("2026-03-02", "08:45"), at("2026-03-02", "17:00"))]);
    expect(r).toMatchObject({ status: "ON_TIME", lateMin: 0 });
  });

  it("no usa el intervalo de otro empleado", () => {
    const [r] = compareToSchedule([shift], [iv(at("2026-03-02", "09:00"), at("2026-03-02", "17:00"), "e2")]);
    expect(r!.status).toBe("ABSENT");
  });
});
