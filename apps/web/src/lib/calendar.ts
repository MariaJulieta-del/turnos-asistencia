import type { BusinessRules, Employee, ScheduledShift } from "@turnos/contract";
import { MS_MIN, localDateKey, type Anomaly, type AttendanceResult, type Interval, type Punch } from "@turnos/core";
import { buildTimesheet } from "./timesheet";

/** Lo de un empleado en un día del calendario: lo planificado contra lo marcado. */
export interface DayEntry {
  employeeId: string;
  /** Turnos que empiezan ese día (uno, o varios si es horario cortado). */
  shifts: ScheduledShift[];
  /** Tramos realmente trabajados que empiezan ese día. */
  intervals: Interval[];
  workedMin: number;
  /** Extra según las reglas del comercio (tope diario), el mismo número que en el registro de horas. */
  extraMin: number;
  plannedMin: number;
  attendance: AttendanceResult[];
  anomalies: Anomaly[];
}

/**
 * Arma el calendario: por fecha local, una entrada por empleado que tenga turno o marcas ese día.
 * Las horas salen de buildTimesheet, así coinciden con "Horas" y con lo que ve el empleado.
 * Para asistencia (puntual/tarde/ausente) solo cuentan los turnos publicados.
 */
export function buildCalendar(
  employees: readonly Employee[],
  shifts: readonly ScheduledShift[],
  punches: readonly Punch[],
  business: BusinessRules,
  now = Number.POSITIVE_INFINITY,
): Map<string, DayEntry[]> {
  const tz = business.tzOffsetMinutes;
  const days = new Map<string, DayEntry[]>();
  const published = shifts.filter((s) => s.status === "PUBLISHED");

  for (const emp of employees) {
    const sheet = buildTimesheet(emp.id, punches, published, business, now);
    const byDay = new Map<string, DayEntry>();
    const entry = (day: string) => {
      let e = byDay.get(day);
      if (!e) {
        e = {
          employeeId: emp.id,
          shifts: [],
          intervals: [],
          workedMin: 0,
          extraMin: 0,
          plannedMin: 0,
          attendance: [],
          anomalies: [],
        };
        byDay.set(day, e);
      }
      return e;
    };

    for (const s of shifts) {
      if (s.employeeId !== emp.id) continue;
      const e = entry(localDateKey(s.start, tz));
      e.shifts.push(s);
      e.plannedMin += Math.round((s.end - s.start) / MS_MIN);
    }
    for (const iv of sheet.intervals) entry(localDateKey(iv.start, tz)).intervals.push(iv);
    for (const [day, b] of Object.entries(sheet.hours.byDay)) {
      const e = entry(day);
      e.workedMin = b.total;
      e.extraMin = b.extra;
    }
    const shiftDay = new Map(published.map((s) => [s.id, localDateKey(s.start, tz)]));
    for (const a of sheet.attendance) {
      const day = shiftDay.get(a.shiftId);
      if (day) entry(day).attendance.push(a);
    }
    for (const a of sheet.anomalies) entry(localDateKey(a.at, tz)).anomalies.push(a);

    for (const [day, e] of byDay) {
      e.shifts.sort((a, b) => a.start - b.start);
      const list = days.get(day) ?? [];
      list.push(e);
      days.set(day, list);
    }
  }
  return days;
}

/** Cantidad de colores de empleado definidos en styles.css (.emp-c0 … .emp-c7). */
export const EMPLOYEE_COLORS = 8;

/** Color fijo por empleado según su orden en la lista del comercio. */
export function colorIndex(employees: readonly Employee[]): Map<string, number> {
  return new Map(employees.map((e, i) => [e.id, i % EMPLOYEE_COLORS]));
}
