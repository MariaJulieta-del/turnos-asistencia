import { MS_MIN, isNightMinute, localDateKey, minuteOfDay } from "./time";
import type { HoursBreakdown, HoursReport, HoursRules, Interval, MinuteKind } from "./types";

/**
 * Reglas por defecto = SUPUESTOS configurables, no ley.
 * Hay que validarlos contra el convenio de comercio vigente y la LCT con un laboralista.
 */
export function defaultRules(holidays: Iterable<string> = []): HoursRules {
  return {
    tzOffsetMinutes: -180,
    nightStartMin: 21 * 60,
    nightEndMin: 6 * 60,
    dailyNormalMin: 8 * 60,
    holidays: new Set(holidays),
  };
}

export function emptyBreakdown(): HoursBreakdown {
  return { normal: 0, extra: 0, night: 0, holiday: 0, total: 0 };
}

/**
 * Precedencia por minuto (decisión abierta, ver docs/REGLAS_HORAS.md):
 *   feriado  >  extra (pasado el tope diario)  >  nocturno  >  normal
 * Cada minuto cae en exactamente una categoría, así total = normal+extra+night+holiday siempre.
 */
export function classifyMinute(minute: number, workedBeforeToday: number, rules: HoursRules): MinuteKind {
  const ms = minute * MS_MIN;
  if (rules.holidays.has(localDateKey(ms, rules.tzOffsetMinutes))) return "holiday";
  if (workedBeforeToday >= rules.dailyNormalMin) return "extra";
  if (isNightMinute(minuteOfDay(ms, rules.tzOffsetMinutes), rules.nightStartMin, rules.nightEndMin)) {
    return "night";
  }
  return "normal";
}

/**
 * Calcula horas de UN empleado. El tope diario se acumula por la fecha local en que EMPIEZA el turno,
 * así un turno nocturno que cruza medianoche cuenta como un solo día.
 * Los minutos incompletos al inicio/fin se truncan.
 */
export function computeHours(intervals: readonly Interval[], rules: HoursRules): HoursReport {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const workedByDay = new Map<string, number>();
  const byDay: Record<string, HoursBreakdown> = {};
  const total = emptyBreakdown();

  for (const iv of sorted) {
    const dayKey = localDateKey(iv.start, rules.tzOffsetMinutes);
    const day = (byDay[dayKey] ??= emptyBreakdown());
    let done = workedByDay.get(dayKey) ?? 0;
    const startMin = Math.floor(iv.start / MS_MIN);
    const endMin = Math.floor(iv.end / MS_MIN);

    for (let m = startMin; m < endMin; m++) {
      const kind = classifyMinute(m, done, rules);
      day[kind]++;
      total[kind]++;
      day.total++;
      total.total++;
      done++;
    }
    workedByDay.set(dayKey, done);
  }

  return { byDay, total };
}
