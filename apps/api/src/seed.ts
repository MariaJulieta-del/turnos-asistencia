import { hashToken } from "./auth";
import type { MemoryData } from "./memoryStore";

/** Datos de ejemplo para correr sin Postgres. Enlaces: token "dueno", "ana", "bruno". */

const OFFSET = -180;
const at = (date: string, hhmm: string): number => {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  return Date.UTC(y, mo - 1, d, h, mi) - OFFSET * 60_000;
};

export function demoData(): MemoryData {
  let seq = 0;
  const punch = (employeeId: string, type: "IN" | "OUT", date: string, hhmm: string) => ({
    id: `seed-${++seq}`,
    employeeId,
    type,
    at: at(date, hhmm),
    receivedAt: at(date, hhmm),
  });
  const shift = (employeeId: string, date: string, from: string, to: string, status: "PUBLISHED" | "DRAFT" = "PUBLISHED") => ({
    id: `shift-${employeeId}-${date}`,
    employeeId,
    start: at(date, from),
    end: at(date, to),
    status,
  });

  return {
    businesses: [
      {
        id: "b1",
        timezone: "America/Argentina/Cordoba",
        nightStartMin: 21 * 60,
        nightEndMin: 6 * 60,
        dailyNormalMin: 480,
        minRestMin: 720,
        graceMin: 5,
      },
    ],
    users: [
      { id: "o1", businessId: "b1", name: "Dueño", role: "OWNER", tokenHash: hashToken("dueno"), active: true },
      { id: "e1", businessId: "b1", name: "Ana López", role: "EMPLOYEE", tokenHash: hashToken("ana"), active: true },
      { id: "e2", businessId: "b1", name: "Bruno Díaz", role: "EMPLOYEE", tokenHash: hashToken("bruno"), active: true },
    ],
    holidays: [],
    // Plaza San Martín, Córdoba. Sirve de ejemplo; el dueño lo cambia desde la pestaña Local.
    workplaces: [{ id: "w1", businessId: "b1", name: "Local centro", lat: -31.4167, lng: -64.1837, radiusM: 100 }],
    templates: [
      { id: "t1", businessId: "b1", name: "Mañana", startMin: 9 * 60, endMin: 17 * 60 },
      { id: "t2", businessId: "b1", name: "Tarde", startMin: 14 * 60, endMin: 22 * 60 },
      { id: "t3", businessId: "b1", name: "Cierre", startMin: 17 * 60, endMin: 60 },
    ],
    shifts: [
      ...["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"].map((d) => shift("e1", d, "09:00", "17:00")),
      ...["2026-10-26", "2026-10-27", "2026-10-28"].map((d) => shift("e2", d, "14:00", "22:00")),
      shift("e1", "2026-10-31", "09:00", "17:00", "DRAFT"),
    ],
    punches: [
      punch("e1", "IN", "2026-10-26", "09:02"),
      punch("e1", "OUT", "2026-10-26", "17:05"),
      punch("e1", "IN", "2026-10-27", "09:20"),
      punch("e1", "OUT", "2026-10-27", "17:00"),
      punch("e1", "IN", "2026-10-28", "09:00"),
      punch("e1", "OUT", "2026-10-28", "19:00"),
      punch("e1", "IN", "2026-10-29", "09:00"),
      punch("e2", "IN", "2026-10-26", "14:00"),
      punch("e2", "OUT", "2026-10-26", "22:30"),
      punch("e2", "OUT", "2026-10-28", "22:00"),
    ],
  };
}
