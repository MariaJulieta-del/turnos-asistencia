import type { Employee } from "@turnos/contract";
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
  listPunches(businessId: string, range: Range, userId?: string): Promise<Punch[]>;
  listPublishedShifts(businessId: string, range: Range, userId?: string): Promise<PlannedShift[]>;
  /**
   * Idempotente por clientEventId (`punch.id`): si ya existe del mismo usuario es "duplicate";
   * si existe de otro usuario, "conflict". Nunca pisa una marca guardada.
   */
  insertPunch(punch: Punch, receivedAt: number): Promise<InsertResult>;
}
