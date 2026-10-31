import type {
  EmployeeSnapshot,
  MonthSchedule,
  NewShiftsInput,
  PublishInput,
  PublishResult,
  PunchAck,
  PunchInput,
  ScheduledShift,
  Snapshot,
  Workplace,
  WorkplaceInput,
} from "@turnos/contract";
import {
  DEMO_TOKENS,
  demoCreateShifts,
  demoPublish,
  demoRemoveShift,
  demoSaveWorkplace,
  demoSchedule,
  demoSnapshot,
  demoWorkplace,
} from "../demo";

export type { Employee, EmployeeSnapshot, Snapshot } from "@turnos/contract";

/** Cliente de apps/api. Sin VITE_API_URL la app corre en modo demo con datos en memoria. */
const BASE = import.meta.env.VITE_API_URL as string | undefined;
export const DEMO_MODE = !BASE;

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Error ${res.status}`);
  }
  return (await res.json()) as T;
}

/** El empleado ve solo lo suyo: reglas del comercio, sus marcas y sus turnos publicados. */
export async function fetchEmployeeSnapshot(token: string): Promise<EmployeeSnapshot> {
  if (!DEMO_MODE) return request("/me/snapshot", token);
  const snap = demoSnapshot();
  const me = snap.employees.find((e) => e.id === DEMO_TOKENS[token]);
  if (!me) throw new Error("Este enlace no es válido. Pedile al dueño que te lo vuelva a mandar.");
  return { ...snap, me };
}

export async function fetchOwnerSnapshot(token: string): Promise<Snapshot> {
  return DEMO_MODE ? demoSnapshot() : request("/owner/snapshot", token);
}

/** Idempotente por punch.id (clientEventId): reenviar la misma marca no la duplica. */
export async function sendPunch(token: string, punch: PunchInput): Promise<void> {
  if (DEMO_MODE) throw new Error("Modo demo: sin API");
  await request<PunchAck>("/punches", token, { method: "POST", body: JSON.stringify(punch) });
}

// ---------- Horarios ----------

/** Calendario del mes "YYYY-MM"; sin mes, el actual del comercio. */
export async function fetchSchedule(token: string, month?: string): Promise<MonthSchedule> {
  if (DEMO_MODE) return demoSchedule(month);
  return request(month ? `/owner/schedule?month=${month}` : "/owner/schedule", token);
}

/** El mismo horario en uno o varios días, como borrador. */
export async function createShifts(token: string, input: NewShiftsInput): Promise<ScheduledShift[]> {
  if (DEMO_MODE) return demoCreateShifts(input);
  return request("/owner/shifts", token, { method: "POST", body: JSON.stringify(input) });
}

// ---------- Lugar de trabajo ----------

export async function fetchWorkplace(token: string): Promise<Workplace | null> {
  if (DEMO_MODE) return demoWorkplace();
  return (await request<{ workplace: Workplace | null }>("/owner/workplace", token)).workplace;
}

export async function saveWorkplace(token: string, input: WorkplaceInput): Promise<Workplace> {
  if (DEMO_MODE) return demoSaveWorkplace(input);
  return (await request<{ workplace: Workplace }>("/owner/workplace", token, { method: "PUT", body: JSON.stringify(input) }))
    .workplace;
}

export async function removeShift(token: string, id: string): Promise<"deleted" | "cancelled"> {
  if (DEMO_MODE) return demoRemoveShift(id);
  return (await request<{ status: "deleted" | "cancelled" }>(`/owner/shifts/${id}`, token, { method: "DELETE" })).status;
}

export async function publishSchedule(token: string, input: PublishInput): Promise<PublishResult> {
  if (DEMO_MODE) return demoPublish(input);
  return request("/owner/schedule/publish", token, { method: "POST", body: JSON.stringify(input) });
}
