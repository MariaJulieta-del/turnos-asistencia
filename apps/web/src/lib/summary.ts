import { MS_MIN, type PlannedShift } from "@turnos/core";
import type { Timesheet } from "./timesheet";

/** Recuento del período de un empleado: lo que el dueño necesita ver de un vistazo. */
export interface EmployeeSummary {
  /** Horas según las marcas (las mismas del registro). */
  workedMin: number;
  normalMin: number;
  extraMin: number;
  nightMin: number;
  holidayMin: number;
  /** Suma de los turnos publicados del período (ya pasados y futuros). */
  plannedMin: number;
  /** Turnos publicados que ya terminaron, para comparar contra lo trabajado. */
  plannedPastMin: number;
  shifts: number;
  onTime: number;
  late: number;
  /** Minutos de tardanza sumados. */
  lateMin: number;
  absent: number;
  /** Turnos que todavía no terminaron (sin evaluar asistencia). */
  upcomingShifts: PlannedShift[];
  /** Anomalías de marcas + avisos de ubicación. */
  toReview: number;
}

export function summarize(sheet: Timesheet, planned: readonly PlannedShift[], now: number): EmployeeSummary {
  const mine = planned.filter((s) => s.employeeId === sheet.employeeId).sort((a, b) => a.start - b.start);
  const minutes = (s: PlannedShift) => Math.round((s.end - s.start) / MS_MIN);
  const { total } = sheet.hours;
  const late = sheet.attendance.filter((a) => a.status === "LATE");
  return {
    workedMin: total.total,
    normalMin: total.normal,
    extraMin: total.extra,
    nightMin: total.night,
    holidayMin: total.holiday,
    plannedMin: mine.reduce((acc, s) => acc + minutes(s), 0),
    plannedPastMin: mine.filter((s) => s.end <= now).reduce((acc, s) => acc + minutes(s), 0),
    shifts: mine.length,
    onTime: sheet.attendance.filter((a) => a.status === "ON_TIME").length,
    late: late.length,
    lateMin: late.reduce((acc, a) => acc + a.lateMin, 0),
    absent: sheet.attendance.filter((a) => a.status === "ABSENT").length,
    upcomingShifts: mine.filter((s) => s.end > now),
    toReview: sheet.anomalies.length + sheet.locationFlags.length,
  };
}

/** Totales del equipo para la cabecera. */
export function teamTotals(summaries: readonly EmployeeSummary[]) {
  return summaries.reduce(
    (acc, s) => ({
      workedMin: acc.workedMin + s.workedMin,
      extraMin: acc.extraMin + s.extraMin,
      late: acc.late + s.late,
      absent: acc.absent + s.absent,
      toReview: acc.toReview + s.toReview,
    }),
    { workedMin: 0, extraMin: 0, late: 0, absent: 0, toReview: 0 },
  );
}
