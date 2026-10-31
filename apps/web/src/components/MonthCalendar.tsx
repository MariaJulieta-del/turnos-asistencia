import type { Employee } from "@turnos/contract";
import type { DayEntry } from "../lib/calendar";
import { formatLongDate, formatMinutes, formatShortSpan, initials } from "../lib/format";

const HEADERS = ["L", "M", "M", "J", "V", "S", "D"];
const HEADERS_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
/** En la vista de todo el equipo, cuántos empleados entran por celda antes de "+N". */
const MAX_PER_CELL = 3;

interface Props {
  month: string;
  dates: string[];
  today: string;
  tz: number;
  holidays: readonly string[];
  days: Map<string, DayEntry[]>;
  employees: Map<string, Employee>;
  colors: Map<string, number>;
  selected: string;
  onSelect: (date: string) => void;
  /** "single": un solo empleado (sus horarios y lo marcado). "team": todos, cada uno con su color. */
  mode: "single" | "team";
}

/**
 * Calendario mensual. Cada día muestra los horarios (de corrido o cortados) y, a medida que pasa la semana,
 * lo trabajado y las horas extra. Tocar un día lo selecciona para ver el detalle debajo.
 */
export function MonthCalendar({ month, dates, today, tz, holidays, days, employees, colors, selected, onSelect, mode }: Props) {
  return (
    // Botones simples (no role="grid"): cada día se anuncia completo y se elige con Tab + Enter.
    <div className="cal" role="group" aria-label="Calendario del mes">
      <div className="cal-head" aria-hidden="true">
        {HEADERS.map((h, i) => (
          <span key={i} title={HEADERS_LONG[i]}>
            {h}
          </span>
        ))}
      </div>
      {Array.from({ length: dates.length / 7 }, (_, w) => (
        <div className="cal-week" key={w}>
          {dates.slice(w * 7, w * 7 + 7).map((date) => {
            const entries = days.get(date) ?? [];
            const outside = !date.startsWith(month);
            const classes = [
              "cal-day",
              outside && "outside",
              date === today && "today",
              date === selected && "selected",
              holidays.includes(date) && "holiday",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={date}
                type="button"
                className={classes}
                aria-pressed={date === selected}
                aria-label={describeDay(date, entries, employees, tz)}
                onClick={() => onSelect(date)}
              >
                <span className="cal-num" aria-hidden="true">
                  {Number(date.slice(8))}
                </span>
                <span className="cal-body" aria-hidden="true">
                  {mode === "single" ? (
                    <SingleCell entry={entries[0]} tz={tz} />
                  ) : (
                    <TeamCell entries={entries} employees={employees} colors={colors} tz={tz} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Un empleado: sus tramos planificados y, si ya trabajó, cuánto y cuánto extra. */
function SingleCell({ entry, tz }: { entry?: DayEntry; tz: number }) {
  if (!entry) return null;
  return (
    <>
      {entry.shifts.map((s) => (
        <span key={s.id} className={`cal-shift ${s.status === "DRAFT" ? "draft" : ""}`}>
          {formatShortSpan(s.start, s.end, tz)}
        </span>
      ))}
      {entry.workedMin > 0 && (
        <span className="cal-worked">
          {formatCompact(entry.workedMin)}
          {entry.extraMin > 0 && <span className="cal-extra">+{formatCompact(entry.extraMin)}</span>}
        </span>
      )}
      {entry.anomalies.length + entry.locationFlags.length > 0 && <span className="cal-flag">!</span>}
    </>
  );
}

/** Todo el equipo: una línea por empleado con su color, iniciales y tramos. */
function TeamCell({
  entries,
  employees,
  colors,
  tz,
}: {
  entries: DayEntry[];
  employees: Map<string, Employee>;
  colors: Map<string, number>;
  tz: number;
}) {
  const withShifts = entries.filter((e) => e.shifts.length > 0 || e.workedMin > 0);
  const shown = withShifts.slice(0, MAX_PER_CELL);
  return (
    <>
      {shown.map((e) => (
        <span
          key={e.employeeId}
          className={`cal-person emp-c${colors.get(e.employeeId) ?? 0} ${e.shifts.every((s) => s.status === "DRAFT") && e.shifts.length ? "draft" : ""}`}
        >
          <b>{initials(employees.get(e.employeeId)?.name ?? "?")}</b>
          {/* Horario cortado: un tramo por línea. */}
          <span className="cal-times">
            {e.shifts.length ? (
              e.shifts.map((s) => <span key={s.id}>{formatShortSpan(s.start, s.end, tz)}</span>)
            ) : (
              <span>{formatCompact(e.workedMin)}</span>
            )}
          </span>
        </span>
      ))}
      {withShifts.length > MAX_PER_CELL && <span className="cal-more">+{withShifts.length - MAX_PER_CELL}</span>}
      {entries.some((e) => e.anomalies.length + e.locationFlags.length > 0) && <span className="cal-flag">!</span>}
    </>
  );
}

/** "8h", "7h40", "40m" para que entre en la celda. */
function formatCompact(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function describeDay(date: string, entries: DayEntry[], employees: Map<string, Employee>, tz: number): string {
  const parts = entries
    .filter((e) => e.shifts.length || e.workedMin)
    .map((e) => {
      const name = employees.get(e.employeeId)?.name ?? "";
      const shifts = e.shifts.map((s) => formatShortSpan(s.start, s.end, tz)).join(" y ");
      const worked = e.workedMin ? `, trabajó ${formatMinutes(e.workedMin)}` : "";
      return `${name} ${shifts || "sin turno"}${worked}`;
    });
  return `${formatLongDate(date)}${parts.length ? ": " + parts.join("; ") : ": sin turnos"}`;
}
