import type { GeoPoint, GeofenceStatus, PlannedShift, Punch } from "@turnos/core";

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

// ---------- Ubicación ----------

/** Lugar de trabajo con geovalla. Es la dirección del comercio, no un dato personal. */
export interface Workplace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
}

/**
 * Resultado de la verificación de ubicación de una marca, calculado en el servidor.
 * NONE: el empleado no compartió la ubicación (o el celular no la pudo obtener).
 * No se guardan coordenadas del empleado: solo esto.
 */
export interface PunchGeo {
  status: GeofenceStatus | "NONE";
  distanceM?: number;
  accuracyM?: number;
}

/** Marca tal como la devuelve la API. `geo` falta si el comercio no tiene local configurado. */
export interface PunchRecord extends Punch {
  geo?: PunchGeo;
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
  punches: PunchRecord[];
  /** Solo turnos publicados. */
  planned: PlannedShift[];
  /** Locales con geovalla. Vacío: no se pide ubicación al fichar. */
  workplaces: Workplace[];
}

export interface EmployeeSnapshot extends Snapshot {
  me: Employee;
}

/**
 * Cuerpo de POST /punches. `employeeId` tiene que coincidir con el dueño del token.
 * `location` se toma solo en el instante de fichar y con consentimiento; el servidor la usa para
 * verificar la geovalla y la descarta.
 */
export interface PunchInput extends Punch {
  location?: GeoPoint;
}

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
  punches: PunchRecord[];
  templates: ShiftTemplate[];
}

/** Cuerpo de POST /owner/schedule/publish: publica los borradores entre esas fechas (inclusive). */
export interface PublishInput {
  from: string;
  to: string;
}

/** Un tramo de horario en minutos desde 00:00 local. Si end <= start, termina al día siguiente. */
export interface ShiftSegment {
  startMin: number;
  endMin: number;
}

/**
 * Cuerpo de POST /owner/shifts: el mismo horario (uno o dos tramos) en uno o varios días.
 * Se crean como borrador.
 */
export interface NewShiftsInput {
  employeeId: string;
  /** Fechas locales "YYYY-MM-DD" en que empieza cada turno. */
  dates: string[];
  segments: ShiftSegment[];
}

export interface PublishResult {
  published: number;
}

export interface PunchAck {
  /** "duplicate": ya estaba (reintento offline). Para el cliente, las dos cuentan como recibida. */
  status: "created" | "duplicate";
  receivedAt: number;
  /** Resultado de la geovalla, si el comercio la tiene configurada. */
  geo?: PunchGeo;
}

/** Cuerpo de PUT /owner/workplace. */
export interface WorkplaceInput {
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
}
