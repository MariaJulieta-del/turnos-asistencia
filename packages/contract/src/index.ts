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

export interface PunchAck {
  /** "duplicate": ya estaba (reintento offline). Para el cliente, las dos cuentan como recibida. */
  status: "created" | "duplicate";
  receivedAt: number;
}
