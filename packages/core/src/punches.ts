import { MS_MIN } from "./time";
import type { Anomaly, Interval, PairOptions, PairResult, Punch } from "./types";

/**
 * Empareja marcas IN/OUT en intervalos trabajados, por empleado.
 * - Deduplica por id (reintentos offline).
 * - Ordena por instante (desempata por id para que sea determinista).
 * - Nunca inventa horas: lo ambiguo queda como anomalía para que decida el dueño.
 */
export function pairPunches(punches: readonly Punch[], options: PairOptions = {}): PairResult {
  const maxIntervalMin = options.maxIntervalMin ?? 960;
  const seen = new Set<string>();
  const byEmployee = new Map<string, Punch[]>();

  for (const p of punches) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const list = byEmployee.get(p.employeeId) ?? [];
    list.push(p);
    byEmployee.set(p.employeeId, list);
  }

  const intervals: Interval[] = [];
  const anomalies: Anomaly[] = [];

  for (const [employeeId, list] of byEmployee) {
    list.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    let open: Punch | null = null;

    for (const p of list) {
      if (p.type === "IN") {
        if (open) {
          anomalies.push({ kind: "DOUBLE_IN", employeeId, at: open.at, punchId: open.id });
        }
        open = p;
      } else if (!open) {
        anomalies.push({ kind: "ORPHAN_OUT", employeeId, at: p.at, punchId: p.id });
      } else {
        const interval: Interval = { employeeId, start: open.at, end: p.at };
        intervals.push(interval);
        if ((p.at - open.at) / MS_MIN > maxIntervalMin) {
          anomalies.push({ kind: "LONG_INTERVAL", employeeId, at: open.at, punchId: open.id });
        }
        open = null;
      }
    }

    if (open) anomalies.push({ kind: "OPEN_IN", employeeId, at: open.at, punchId: open.id });
  }

  intervals.sort((a, b) => a.start - b.start);
  anomalies.sort((a, b) => a.at - b.at);
  return { intervals, anomalies };
}
