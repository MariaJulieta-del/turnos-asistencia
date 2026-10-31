import { MS_MIN, localDateKey } from "./time";

const MS_DAY = 1440 * MS_MIN;

function dateToUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Suma días a una fecha local "YYYY-MM-DD". */
export function addDays(date: string, days: number): string {
  return new Date(dateToUtc(date) + days * MS_DAY).toISOString().slice(0, 10);
}

/** Lunes de la semana de una fecha local. */
export function mondayOf(date: string): string {
  const weekday = new Date(dateToUtc(date)).getUTCDay(); // 0 = domingo
  return addDays(date, -((weekday + 6) % 7));
}

/** Lunes de la semana (fecha local) que contiene el instante. */
export function weekStart(ms: number, tzOffsetMinutes: number): string {
  return mondayOf(localDateKey(ms, tzOffsetMinutes));
}

/** Las 7 fechas de la semana que empieza en `monday`. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Fechas de la grilla de un calendario mensual "YYYY-MM": semanas completas de lunes a domingo,
 * desde el lunes anterior al día 1 hasta el domingo posterior al último día.
 */
export function monthGridDates(month: string): string[] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const dates: string[] = [];
  for (let d = mondayOf(first); d <= last || dates.length % 7 !== 0; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/** Suma meses a "YYYY-MM". */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/**
 * Instantes de un turno planificado a partir de la fecha local y los minutos desde 00:00.
 * Si `endMin <= startMin` el turno cruza medianoche y termina al día siguiente (ej. 17:00–01:00).
 */
export function shiftInstants(
  date: string,
  startMin: number,
  endMin: number,
  tzOffsetMinutes: number,
): { start: number; end: number } {
  for (const m of [startMin, endMin]) {
    if (!Number.isInteger(m) || m < 0 || m >= 1440) throw new RangeError(`Minuto fuera de rango: ${m}`);
  }
  const midnight = dateToUtc(date) - tzOffsetMinutes * MS_MIN;
  const endOffset = endMin <= startMin ? endMin + 1440 : endMin;
  return { start: midnight + startMin * MS_MIN, end: midnight + endOffset * MS_MIN };
}
