import { MS_MIN, type AnomalyKind, type AttendanceStatus } from "@turnos/core";

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

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "YYYY-MM-DD" -> "lun 02/03". */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  DOUBLE_IN: "Dos entradas seguidas",
  ORPHAN_OUT: "Salida sin entrada",
  OPEN_IN: "Entrada sin salida",
  LONG_INTERVAL: "Turno de más de 16 h",
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  ON_TIME: "Puntual",
  LATE: "Tarde",
  ABSENT: "Ausente",
};
