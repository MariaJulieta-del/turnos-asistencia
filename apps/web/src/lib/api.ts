import type { EmployeeSnapshot, PunchAck, Snapshot } from "@turnos/contract";
import type { Punch } from "@turnos/core";

export type { Employee, EmployeeSnapshot, Snapshot } from "@turnos/contract";

/** Cliente de apps/api. Sin VITE_API_URL la app corre en modo demo. */
const BASE = import.meta.env.VITE_API_URL as string | undefined;
export const DEMO_MODE = !BASE;

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status} en ${path}`);
  return (await res.json()) as T;
}

/** El empleado ve solo lo suyo: reglas del comercio, sus marcas y sus turnos publicados. */
export function fetchEmployeeSnapshot(token: string): Promise<EmployeeSnapshot> {
  return request("/me/snapshot", token);
}

export function fetchOwnerSnapshot(token: string): Promise<Snapshot> {
  return request("/owner/snapshot", token);
}

/** Idempotente por punch.id (clientEventId): reenviar la misma marca no la duplica. */
export async function sendPunch(token: string, punch: Punch): Promise<void> {
  if (DEMO_MODE) throw new Error("Modo demo: sin API");
  await request<PunchAck>("/punches", token, { method: "POST", body: JSON.stringify(punch) });
}
