import { MS_MIN } from "./time";
import type { Interval, RestViolation } from "./types";

/**
 * Detecta descansos entre jornadas menores al mínimo (default 720 min = 12 h).
 * SUPUESTO configurable: verificar contra la normativa aplicable.
 */
export function findRestViolations(intervals: readonly Interval[], minRestMin = 720): RestViolation[] {
  const byEmployee = new Map<string, Interval[]>();
  for (const iv of intervals) {
    const list = byEmployee.get(iv.employeeId) ?? [];
    list.push(iv);
    byEmployee.set(iv.employeeId, list);
  }

  const out: RestViolation[] = [];
  for (const [employeeId, list] of byEmployee) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const next = list[i]!;
      const restMin = Math.floor((next.start - prev.end) / MS_MIN);
      if (restMin < minRestMin) {
        out.push({ employeeId, previousEnd: prev.end, nextStart: next.start, restMin });
      }
    }
  }
  return out.sort((a, b) => a.nextStart - b.nextStart);
}
