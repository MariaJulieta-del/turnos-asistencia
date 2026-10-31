import { MS_MIN, localDateKey } from "@turnos/core";
import type { Range } from "./store";

/**
 * Offset en minutos de una zona IANA en un instante dado ("America/Argentina/Cordoba" -> -180).
 * Core trabaja con un offset fijo por período; alcanza para Argentina, que no tiene horario de verano.
 */
export function tzOffsetMinutes(timeZone: string, at: number): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

export function currentMonth(now: number, offset: number): string {
  return localDateKey(now, offset).slice(0, 7);
}

/** Instantes del mes local "YYYY-MM": desde las 00:00 del día 1 hasta las 00:00 del mes siguiente. */
export function monthRange(month: string, offset: number): Range {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return {
    from: Date.UTC(y, m - 1, 1) - offset * MS_MIN,
    to: Date.UTC(y, m, 1) - offset * MS_MIN,
  };
}
