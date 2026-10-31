import { MS_MIN, localDateKey, type AnomalyKind, type AttendanceStatus } from "@turnos/core";

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "HH:MM" en la zona del comercio, no la del navegador. */
export function formatTime(ms: number, tzOffsetMinutes: number): string {
  return new Date(ms + tzOffsetMinutes * MS_MIN).toISOString().slice(11, 16);
}

/** Hora corta para las celdas del calendario: "9", "9:30", "17". */
export function formatShortTime(ms: number, tzOffsetMinutes: number): string {
  const [h, m] = formatTime(ms, tzOffsetMinutes).split(":") as [string, string];
  return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
}

/** Tramo corto "9–17" para las celdas. */
export function formatShortSpan(start: number, end: number, tz: number): string {
  return `${formatShortTime(start, tz)}–${formatShortTime(end, tz)}`;
}

/** Minutos desde 00:00 -> "HH:MM". */
export function formatHM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** "HH:MM" -> minutos desde 00:00, o null si no es una hora válida. */
export function parseHM(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEKDAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function parts(key: string) {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "YYYY-MM-DD" -> "lun 02/03". */
export function formatDateKey(key: string): string {
  const { m, d, wd } = parts(key);
  return `${WEEKDAYS[wd]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" -> "viernes 30 de octubre". */
export function formatLongDate(key: string): string {
  const { m, d, wd } = parts(key);
  return `${WEEKDAYS_LONG[wd]} ${d} de ${MONTHS[m - 1]}`;
}

/** "YYYY-MM-DD" -> { weekday: "lun", day: "26" } para los chips de fecha. */
export function dateChip(key: string): { weekday: string; day: string } {
  const { d, wd } = parts(key);
  return { weekday: WEEKDAYS[wd]!, day: String(d) };
}

/** "2026-10" -> "octubre 2026". */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

/** Rango corto de una semana: "26 oct – 1 nov". */
export function formatWeekRange(first: string, last: string): string {
  const a = parts(first);
  const b = parts(last);
  return `${a.d} ${MONTHS[a.m - 1]!.slice(0, 3)} – ${b.d} ${MONTHS[b.m - 1]!.slice(0, 3)}`;
}

/** Tramo "09:00–17:00", con la fecha de fin si termina otro día. */
export function formatSpan(start: number, end: number, tz: number): string {
  const endDay = localDateKey(end, tz);
  const suffix = endDay === localDateKey(start, tz) ? "" : ` (${formatDateKey(endDay)})`;
  return `${formatTime(start, tz)}–${formatTime(end, tz)}${suffix}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  DOUBLE_IN: "Dos entradas seguidas",
  ORPHAN_OUT: "Salida sin entrada",
  OPEN_IN: "Falta marcar la salida",
  LONG_INTERVAL: "Turno de más de 16 h",
};

/** Qué hacer con cada anomalía, según quién la mira. */
export const ANOMALY_HINT: Record<AnomalyKind, { employee: string; owner: string }> = {
  OPEN_IN: {
    employee: "Ese día no suma horas hasta que se corrija. Avisale al dueño a qué hora saliste.",
    owner: "Ese día no suma horas hasta que se corrija. Consultá con el empleado a qué hora salió.",
  },
  DOUBLE_IN: {
    employee: "Se tomó la última entrada. Si no es la correcta, avisale al dueño.",
    owner: "Se tomó la última entrada. Revisá con el empleado cuál es la correcta.",
  },
  ORPHAN_OUT: {
    employee: "Hay una salida sin entrada y no suma horas. Avisale al dueño a qué hora entraste.",
    owner: "Hay una salida sin entrada y no suma horas. Consultá a qué hora entró.",
  },
  LONG_INTERVAL: {
    employee: "Se cuenta igual, pero puede ser una salida que te olvidaste de marcar.",
    owner: "Se cuenta igual, pero puede ser una salida olvidada. Conviene revisarlo.",
  },
};

/** Texto del aviso de ubicación de una marca ("Entrada 09:20 fuera del local, a 850 m"). */
export function describeLocationFlag(
  flag: { type: "IN" | "OUT"; at: number; geo: { status: string; distanceM?: number; accuracyM?: number } },
  tz: number,
): string {
  const what = `${flag.type === "IN" ? "Entrada" : "Salida"} de las ${formatTime(flag.at, tz)}`;
  switch (flag.geo.status) {
    case "OUTSIDE":
      return `${what}: fuera del local, a ${formatDistance(flag.geo.distanceM ?? 0)}.`;
    case "UNCERTAIN":
      return `${what}: no se pudo confirmar que estuviera en el local (GPS impreciso${flag.geo.accuracyM ? `, ±${formatDistance(flag.geo.accuracyM)}` : ""}).`;
    default:
      return `${what}: sin ubicación.`;
  }
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`;
}

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  ON_TIME: "Puntual",
  LATE: "Tarde",
  ABSENT: "Ausente",
};
