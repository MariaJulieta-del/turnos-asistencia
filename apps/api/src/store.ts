import type {
  Employee,
  PunchGeo,
  PunchRecord,
  ScheduledShift,
  ShiftTemplate,
  Workplace,
  WorkplaceInput,
} from "@turnos/contract";
import type { PlannedShift, Punch } from "@turnos/core";

/** Acceso a datos. La API habla solo con esta interfaz: Prisma en producción, memoria en tests y demo. */

export type Role = "OWNER" | "MANAGER" | "EMPLOYEE";

export interface AuthUser {
  id: string;
  businessId: string;
  name: string;
  role: Role;
}

export interface BusinessRow {
  id: string;
  timezone: string;
  nightStartMin: number;
  nightEndMin: number;
  dailyNormalMin: number;
  minRestMin: number;
  graceMin: number;
}

/** Rango de instantes [from, to) en epoch ms. */
export interface Range {
  from: number;
  to: number;
}

export type InsertResult = "created" | "duplicate" | "conflict";

export interface Store {
  /** Usuario activo dueño del token (guardado hasheado). */
  findUserByTokenHash(hash: string): Promise<AuthUser | null>;
  getBusiness(id: string): Promise<BusinessRow | null>;
  /** Fechas "YYYY-MM-DD" de feriados del mes "YYYY-MM". */
  listHolidays(businessId: string, month: string): Promise<string[]>;
  listActiveUsers(businessId: string): Promise<Employee[]>;
  listPunches(businessId: string, range: Range, userId?: string): Promise<PunchRecord[]>;
  listPublishedShifts(businessId: string, range: Range, userId?: string): Promise<PlannedShift[]>;
  /**
   * Idempotente por clientEventId (`punch.id`): si ya existe del mismo usuario es "duplicate";
   * si existe de otro usuario, "conflict". Nunca pisa una marca guardada.
   * `geo`: resultado de la geovalla (null si el comercio no tiene local). Nunca se guardan coordenadas.
   */
  insertPunch(punch: Punch, receivedAt: number, geo: PunchGeo | null): Promise<InsertResult>;

  // ---------- Ubicación ----------
  /** Locales con geovalla configurada. */
  listWorkplaces(businessId: string): Promise<Workplace[]>;
  /** MVP: un local por comercio. Crea o actualiza el primero. */
  saveWorkplace(businessId: string, input: WorkplaceInput): Promise<Workplace>;

  // ---------- Horarios ----------
  listTemplates(businessId: string): Promise<ShiftTemplate[]>;
  /** Borradores y publicados (no cancelados) que empiezan en el rango. */
  listShifts(businessId: string, range: Range): Promise<ScheduledShift[]>;
  /** Crea turnos en borrador (todos o ninguno). */
  createShifts(shifts: { employeeId: string; start: number; end: number }[]): Promise<ScheduledShift[]>;
  /**
   * Un borrador se borra. Uno publicado se cancela (queda el registro de que existió).
   * "not_found" si no existe o es de otro comercio.
   */
  removeShift(businessId: string, id: string): Promise<"deleted" | "cancelled" | "not_found">;
  /** Publica los borradores del rango. Devuelve cuántos. */
  publishShifts(businessId: string, range: Range): Promise<number>;
}
