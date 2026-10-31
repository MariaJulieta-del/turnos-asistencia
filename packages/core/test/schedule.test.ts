import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  findRestViolations,
  mondayOf,
  monthGridDates,
  shiftInstants,
  weekDates,
  weekStart,
} from "../src/index";

const OFFSET = -180;
const iso = (ms: number) => new Date(ms).toISOString();

describe("shiftInstants", () => {
  it("convierte un turno del día a instantes UTC", () => {
    const s = shiftInstants("2026-11-02", 9 * 60, 17 * 60, OFFSET);
    expect(iso(s.start)).toBe("2026-11-02T12:00:00.000Z");
    expect(iso(s.end)).toBe("2026-11-02T20:00:00.000Z");
  });

  it("un turno que cruza medianoche termina al día siguiente", () => {
    const s = shiftInstants("2026-11-02", 17 * 60, 60, OFFSET);
    expect(iso(s.start)).toBe("2026-11-02T20:00:00.000Z");
    expect(iso(s.end)).toBe("2026-11-03T04:00:00.000Z");
    expect((s.end - s.start) / 60_000).toBe(480);
  });

  it("si entrada y salida coinciden se toma como turno de 24 h", () => {
    const s = shiftInstants("2026-11-02", 600, 600, OFFSET);
    expect((s.end - s.start) / 60_000).toBe(1440);
  });

  it("rechaza minutos fuera del día", () => {
    expect(() => shiftInstants("2026-11-02", -1, 60, OFFSET)).toThrow(RangeError);
    expect(() => shiftInstants("2026-11-02", 0, 1440, OFFSET)).toThrow(RangeError);
  });
});

describe("horario cortado", () => {
  const h = (date: string, from: number, to: number) => ({
    employeeId: "e1",
    ...shiftInstants(date, from * 60, to * 60, OFFSET),
  });

  it("la pausa entre dos tramos del mismo día no es falta de descanso", () => {
    const split = [h("2026-11-02", 9, 13), h("2026-11-02", 17, 21)];
    expect(findRestViolations(split, 720, OFFSET)).toEqual([]);
    // Sin zona horaria se mantiene el comportamiento anterior: cada tramo es una jornada.
    expect(findRestViolations(split, 720)).toHaveLength(1);
  });

  it("entre días distintos sí se controla el descanso", () => {
    const v = findRestViolations([h("2026-11-02", 17, 21), h("2026-11-03", 6, 14)], 720, OFFSET);
    expect(v.map((x) => x.restMin)).toEqual([540]);
  });

  it("dos tramos superpuestos del mismo día se reportan", () => {
    const v = findRestViolations([h("2026-11-02", 9, 13), h("2026-11-02", 12, 16)], 720, OFFSET);
    expect(v.map((x) => x.restMin)).toEqual([-60]);
  });
});

describe("semanas", () => {
  it("suma días cruzando fin de mes", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-11-02", -7)).toBe("2026-10-26");
  });

  it("el lunes de la semana se calcula en hora local", () => {
    // Domingo 01/11 a las 23:30 en Argentina = lunes 02:30 UTC: sigue siendo la semana del 26/10.
    expect(weekStart(Date.UTC(2026, 10, 2, 2, 30), OFFSET)).toBe("2026-10-26");
    expect(weekStart(Date.UTC(2026, 10, 2, 12, 0), OFFSET)).toBe("2026-11-02");
  });

  it("el lunes de una fecha local", () => {
    expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // domingo
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
  });

  it("la grilla del mes son semanas completas de lunes a domingo", () => {
    const oct = monthGridDates("2026-10"); // 1/10/2026 es jueves, 31/10 es sábado
    expect(oct[0]).toBe("2026-09-28");
    expect(oct.at(-1)).toBe("2026-11-01");
    expect(oct).toHaveLength(35);
    const feb = monthGridDates("2027-02"); // 1/2/2027 es lunes, 28/2 es domingo
    expect(feb[0]).toBe("2027-02-01");
    expect(feb).toHaveLength(28);
  });

  it("suma meses cruzando el año", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("una semana tiene 7 fechas desde el lunes", () => {
    expect(weekDates("2026-10-26")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});
