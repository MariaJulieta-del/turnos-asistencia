import type { PlannedShift, Punch } from "@turnos/core";
import type { Employee, Snapshot } from "./lib/api";

/** Datos de ejemplo para ver las pantallas mientras no exista apps/api. */

const OFFSET = -180;
/** Hora local de Argentina -> epoch ms. */
const at = (date: string, hhmm: string): number => {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  return Date.UTC(y, mo - 1, d, h, mi) - OFFSET * 60_000;
};

let seq = 0;
const p = (employeeId: string, type: Punch["type"], date: string, hhmm: string): Punch => ({
  id: `demo-${++seq}`,
  employeeId,
  type,
  at: at(date, hhmm),
});
const shift = (employeeId: string, date: string, from: string, to: string): PlannedShift => ({
  id: `shift-${employeeId}-${date}`,
  employeeId,
  start: at(date, from),
  end: at(date, to),
});

export const DEMO_TOKENS: Record<string, string> = { ana: "e1", bruno: "e2" };

const employees: Employee[] = [
  { id: "e1", name: "Ana López" },
  { id: "e2", name: "Bruno Díaz" },
];

export const DEMO_SNAPSHOT: Snapshot = {
  month: "2026-10",
  business: {
    tzOffsetMinutes: OFFSET,
    nightStartMin: 21 * 60,
    nightEndMin: 6 * 60,
    dailyNormalMin: 480,
    minRestMin: 720,
    graceMin: 5,
    holidays: [],
  },
  employees,
  planned: [
    ...["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"].map((d) => shift("e1", d, "09:00", "17:00")),
    ...["2026-10-26", "2026-10-27", "2026-10-28"].map((d) => shift("e2", d, "14:00", "22:00")),
  ],
  punches: [
    p("e1", "IN", "2026-10-26", "09:02"),
    p("e1", "OUT", "2026-10-26", "17:05"),
    p("e1", "IN", "2026-10-27", "09:20"),
    p("e1", "OUT", "2026-10-27", "17:00"),
    p("e1", "IN", "2026-10-28", "09:00"),
    p("e1", "OUT", "2026-10-28", "19:00"),
    p("e1", "IN", "2026-10-29", "09:00"),
    p("e2", "IN", "2026-10-26", "14:00"),
    p("e2", "OUT", "2026-10-26", "22:30"),
    p("e2", "OUT", "2026-10-28", "22:00"),
  ],
};
