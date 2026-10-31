import type { PlannedShift, Punch } from "@turnos/core";

/** Reglas del comercio (espejo de Business en packages/db). Son supuestos configurables, ver docs/REGLAS_HORAS.md. */
export interface BusinessRules {
  tzOffsetMinutes: number;
  nightStartMin: number;
  nightEndMin: number;
  dailyNormalMin: number;
  minRestMin: number;
  graceMin: number;
  /** Feriados del período, "YYYY-MM-DD" local. */
  holidays: string[];
}

export interface Employee {
  id: string;
  name: string;
}

/**
 * Datos crudos de un período. La API no calcula horas: el cliente las calcula con @turnos/core,
 * así dueño y empleado ven el mismo resultado a partir de los mismos datos.
 */
export interface Snapshot {
  /** "YYYY-MM" local del comercio. */
  month: string;
  business: BusinessRules;
  employees: Employee[];
  /** `id` es el clientEventId. */
  punches: Punch[];
  /** Solo turnos publicados. */
  planned: PlannedShift[];
}

export interface EmployeeSnapshot extends Snapshot {
  me: Employee;
}

/** Cuerpo de POST /punches. `employeeId` tiene que coincidir con el dueño del token. */
export type PunchInput = Punch;

// ---------- Horarios (panel del dueño) ----------

/** Borrador: solo lo ve el dueño. Publicado: lo ve el empleado. */
export type ShiftStatus = "DRAFT" | "PUBLISHED";

export interface ScheduledShift extends PlannedShift {
  status: ShiftStatus;
}

/** Turno típico del comercio ("Mañana 09–17"). Minutos desde 00:00 local; si end <= start, cruza medianoche. */
export interface ShiftTemplate {
  id: string;
  name: string;
  startMin: number;
  endMin: number;
}

/**
 * Calendario mensual del dueño. `dates` es la grilla completa (semanas de lunes a domingo), así que
 * incluye días del mes anterior y siguiente; turnos y marcas cubren toda la grilla.
 */
export interface MonthSchedule {
  /** "YYYY-MM". */
  month: string;
  dates: string[];
  business: BusinessRules;
  employees: Employee[];
  /** Borradores y publicados. */
  shifts: ScheduledShift[];
  /** Marcas reales, para ver lo trabajado contra lo planificado. */
  punches: Punch[];
  templates: ShiftTemplate[];
}

/** Cuerpo de POST /owner/schedule/publish: publica los borradores entre esas fechas (inclusive). */
export interface PublishInput {
  from: string;
  to: string;
}

/** Cuerpo de POST /owner/shifts. El turno se crea como borrador. */
export interface NewShiftInput {
  employeeId: string;
  /** Fecha local "YYYY-MM-DD" en que empieza. */
  date: string;
  startMin: number;
  endMin: number;
}

export interface PublishResult {
  published: number;
}

export interface PunchAck {
  /** "duplicate": ya estaba (reintento offline). Para el cliente, las dos cuentan como recibida. */
  status: "created" | "duplicate";
  receivedAt: number;
}
