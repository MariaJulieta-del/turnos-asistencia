import { MS_MIN } from "./time";
import type { AttendanceResult, Interval, PlannedShift } from "./types";

export interface AttendanceOptions {
  /** Minutos de tolerancia antes de considerar tardanza. Default 5. */
  graceMin?: number;
  /** Cuánto antes del inicio planificado se acepta una entrada para ese turno. Default 120. */
  earlyWindowMin?: number;
}

/**
 * Compara turnos planificados contra intervalos trabajados: puntual, tarde o ausente.
 * Cada intervalo se asigna a un solo turno (el primero, por orden de inicio, cuya ventana lo contiene).
 */
export function compareToSchedule(
  planned: readonly PlannedShift[],
  intervals: readonly Interval[],
  options: AttendanceOptions = {},
): AttendanceResult[] {
  const graceMin = options.graceMin ?? 5;
  const earlyMs = (options.earlyWindowMin ?? 120) * MS_MIN;
  const used = new Set<Interval>();
  const shifts = [...planned].sort((a, b) => a.start - b.start);
  const results: AttendanceResult[] = [];

  for (const s of shifts) {
    const match = intervals
      .filter(
        (iv) =>
          iv.employeeId === s.employeeId && !used.has(iv) && iv.start >= s.start - earlyMs && iv.start < s.end,
      )
      .sort((a, b) => a.start - b.start)[0];

    if (!match) {
      results.push({ shiftId: s.id, employeeId: s.employeeId, status: "ABSENT", lateMin: 0 });
      continue;
    }
    used.add(match);
    const lateMin = Math.max(0, Math.floor((match.start - s.start) / MS_MIN));
    results.push({
      shiftId: s.id,
      employeeId: s.employeeId,
      status: lateMin > graceMin ? "LATE" : "ON_TIME",
      lateMin,
      interval: match,
    });
  }
  return results;
}
