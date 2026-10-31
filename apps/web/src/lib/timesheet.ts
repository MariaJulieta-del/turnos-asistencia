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

export function buildTimesheet(
  employeeId: string,
  punches: readonly Punch[],
  planned: readonly PlannedShift[],
  business: BusinessRules,
): Timesheet {
  const own = punches.filter((p) => p.employeeId === employeeId);
  const { intervals, anomalies } = pairPunches(own);
  return {
    employeeId,
    intervals,
    anomalies,
    hours: computeHours(intervals, toHoursRules(business)),
    attendance: compareToSchedule(
      planned.filter((s) => s.employeeId === employeeId),
      intervals,
      { graceMin: business.graceMin },
    ),
    restViolations: findRestViolations(intervals, business.minRestMin),
  };
}

/** Próxima marca esperada según la última conocida. Si la última es IN, toca salir. */
export function nextPunchType(punches: readonly Punch[], employeeId: string): Punch["type"] {
  let last: Punch | undefined;
  for (const p of punches) {
    if (p.employeeId === employeeId && (!last || p.at >= last.at)) last = p;
  }
  return last?.type === "IN" ? "OUT" : "IN";
}
