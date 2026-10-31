import {
  compareToSchedule,
  computeHours,
  findRestViolations,
  pairPunches,
  type Anomaly,
  type AttendanceResult,
  type HoursReport,
  type HoursRules,
  type Interval,
  type PlannedShift,
  type Punch,
  type RestViolation,
} from "@turnos/core";
import type { BusinessRules } from "@turnos/contract";

export type { BusinessRules };

export function toHoursRules(b: BusinessRules): HoursRules {
  return {
    tzOffsetMinutes: b.tzOffsetMinutes,
    nightStartMin: b.nightStartMin,
    nightEndMin: b.nightEndMin,
    dailyNormalMin: b.dailyNormalMin,
    holidays: new Set(b.holidays),
  };
}

/** Registro de un empleado. Dueño y empleado ven exactamente este mismo cálculo. */
export interface Timesheet {
  employeeId: string;
  intervals: Interval[];
  anomalies: Anomaly[];
  hours: HoursReport;
  attendance: AttendanceResult[];
  restViolations: RestViolation[];
}

/**
 * `now`: un turno que todavía no terminó no se marca "Ausente" (puede estar por llegar o trabajando sin
 * haber marcado la salida). Sin `now` se evalúan todos, como hace core.
 */
export function buildTimesheet(
  employeeId: string,
  punches: readonly Punch[],
  planned: readonly PlannedShift[],
  business: BusinessRules,
  now = Number.POSITIVE_INFINITY,
): Timesheet {
  const own = punches.filter((p) => p.employeeId === employeeId);
  const { intervals, anomalies } = pairPunches(own);
  const mine = planned.filter((s) => s.employeeId === employeeId);
  const endOf = new Map(mine.map((s) => [s.id, s.end]));
  return {
    employeeId,
    intervals,
    anomalies,
    hours: computeHours(intervals, toHoursRules(business)),
    attendance: compareToSchedule(mine, intervals, { graceMin: business.graceMin }).filter(
      (a) => a.status !== "ABSENT" || (endOf.get(a.shiftId) ?? 0) <= now,
    ),
    restViolations: findRestViolations(intervals, business.minRestMin, business.tzOffsetMinutes),
  };
}

export function lastPunch(punches: readonly Punch[], employeeId: string): Punch | undefined {
  let last: Punch | undefined;
  for (const p of punches) {
    if (p.employeeId === employeeId && (!last || p.at >= last.at)) last = p;
  }
  return last;
}

/** Próxima marca esperada según la última conocida. Si la última es IN, toca salir. */
export function nextPunchType(punches: readonly Punch[], employeeId: string): Punch["type"] {
  return lastPunch(punches, employeeId)?.type === "IN" ? "OUT" : "IN";
}

export interface ScheduleWarning {
  kind: "overlap" | "short_rest";
  employeeId: string;
  /** Inicio del turno que choca o que llega con poco descanso. */
  at: number;
  restMin: number;
}

/**
 * Avisos sobre turnos planificados (borradores incluidos), antes de publicar.
 * Usa la misma regla de descanso que el registro real. Son avisos: no bloquean.
 */
export function checkSchedule(
  shifts: readonly PlannedShift[],
  minRestMin: number,
  tzOffsetMinutes: number,
): ScheduleWarning[] {
  return findRestViolations(shifts, minRestMin, tzOffsetMinutes).map((v) => ({
    kind: v.restMin < 0 ? "overlap" : "short_rest",
    employeeId: v.employeeId,
    at: v.nextStart,
    restMin: v.restMin,
  }));
}
