import { MS_MIN, localDateKey } from "./time";
import type { Interval, RestViolation } from "./types";

/**
 * Detecta descansos entre jornadas menores al mínimo (default 720 min = 12 h).
 * SUPUESTO configurable: verificar contra la normativa aplicable.
 *
 * Con `tzOffsetMinutes`, los tramos que empiezan el mismo día local son una sola jornada (horario cortado,
 * ej. 9–13 y 17–21): la pausa entre ellos no es descanso entre jornadas y no se reporta. Si se superponen
 * (descanso negativo) se reporta igual.
 */
export function findRestViolations(
  intervals: readonly Interval[],
  minRestMin = 720,
  tzOffsetMinutes?: number,
): RestViolation[] {
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
      const sameDay =
        tzOffsetMinutes !== undefined &&
        localDateKey(prev.start, tzOffsetMinutes) === localDateKey(next.start, tzOffsetMinutes);
      if (restMin < 0 || (!sameDay && restMin < minRestMin)) {
        out.push({ employeeId, previousEnd: prev.end, nextStart: next.start, restMin });
      }
    }
  }
  return out.sort((a, b) => a.nextStart - b.nextStart);
}
