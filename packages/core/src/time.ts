export const MS_MIN = 60_000;

/** Fecha local "YYYY-MM-DD" de un instante, dado el offset en minutos respecto de UTC. */
export function localDateKey(ms: number, tzOffsetMinutes: number): string {
  return new Date(ms + tzOffsetMinutes * MS_MIN).toISOString().slice(0, 10);
}

/** Minuto del día local (0..1439). */
export function minuteOfDay(ms: number, tzOffsetMinutes: number): number {
  const m = Math.floor((ms + tzOffsetMinutes * MS_MIN) / MS_MIN);
  return ((m % 1440) + 1440) % 1440;
}

/** ¿El minuto del día cae en la franja nocturna? Soporta franjas que cruzan medianoche (21:00–06:00). */
export function isNightMinute(mod: number, nightStartMin: number, nightEndMin: number): boolean {
  return nightStartMin > nightEndMin
    ? mod >= nightStartMin || mod < nightEndMin
    : mod >= nightStartMin && mod < nightEndMin;
}
