/** Todos los instantes son milisegundos desde epoch (UTC). La zona horaria se aplica solo al clasificar. */

export type PunchType = "IN" | "OUT";

export interface Punch {
  /** Id idempotente generado en el celular (clientEventId). Un reintento offline no duplica la marca. */
  id: string;
  employeeId: string;
  type: PunchType;
  at: number;
}

export interface Interval {
  employeeId: string;
  start: number;
  end: number;
}

export type AnomalyKind =
  /** Dos entradas seguidas: la anterior se descarta y se avisa al dueño. */
  | "DOUBLE_IN"
  /** Salida sin entrada previa. */
  | "ORPHAN_OUT"
  /** Entrada sin salida (se olvidó de fichar). */
  | "OPEN_IN"
  /** Intervalo más largo que el máximo razonable (se calcula igual, pero se revisa). */
  | "LONG_INTERVAL";

export interface Anomaly {
  kind: AnomalyKind;
  employeeId: string;
  at: number;
  punchId?: string;
}

export interface PairResult {
  intervals: Interval[];
  anomalies: Anomaly[];
}

export interface PairOptions {
  /** Intervalos más largos que esto se marcan LONG_INTERVAL. Default 960 (16 h). */
  maxIntervalMin?: number;
}

export interface HoursRules {
  /** Minutos de diferencia con UTC. Argentina: -180 (sin horario de verano). */
  tzOffsetMinutes: number;
  /** Inicio de la franja nocturna, en minutos desde 00:00 local. SUPUESTO: 21:00. Verificar convenio. */
  nightStartMin: number;
  /** Fin de la franja nocturna. SUPUESTO: 06:00. Verificar convenio. */
  nightEndMin: number;
  /** Minutos "normales" por día antes de empezar a contar extras. SUPUESTO: 480. Verificar convenio. */
  dailyNormalMin: number;
  /** Fechas locales "YYYY-MM-DD" que son feriado. */
  holidays: ReadonlySet<string>;
}

export type MinuteKind = "normal" | "extra" | "night" | "holiday";

export interface HoursBreakdown {
  normal: number;
  extra: number;
  night: number;
  holiday: number;
  total: number;
}

export interface HoursReport {
  /** Clave: fecha local del inicio del turno. */
  byDay: Record<string, HoursBreakdown>;
  total: HoursBreakdown;
}

export interface RestViolation {
  employeeId: string;
  previousEnd: number;
  nextStart: number;
  restMin: number;
}

export interface PlannedShift {
  id: string;
  employeeId: string;
  start: number;
  end: number;
}

export type AttendanceStatus = "ON_TIME" | "LATE" | "ABSENT";

export interface AttendanceResult {
  shiftId: string;
  employeeId: string;
  status: AttendanceStatus;
  lateMin: number;
  interval?: Interval;
}
