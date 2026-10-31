import type { ReactNode } from "react";
import { AlertTriangle, MapPin, TrendingUp } from "lucide-react";
import type { Employee, ScheduledShift } from "@turnos/contract";
import type { DayEntry } from "../lib/calendar";
import {
  ANOMALY_HINT,
  ANOMALY_LABEL,
  describeLocationFlag,
  formatLongDate,
  formatMinutes,
  formatSpan,
  initials,
} from "../lib/format";
import { AttendanceBadge } from "./TimesheetView";

interface Props {
  date: string;
  today: string;
  tz: number;
  isHoliday: boolean;
  entries: DayEntry[];
  employees: Map<string, Employee>;
  colors: Map<string, number>;
  audience: "employee" | "owner";
  /** Solo el dueño: tocar un turno para quitarlo/cancelarlo. */
  onOpenShift?: (shift: ScheduledShift) => void;
  /** Acciones al pie (ej. "Asignar turno"). */
  actions?: ReactNode;
  emptyText: string;
}

/** Detalle del día elegido: por empleado, turno asignado, lo marcado, horas y extra. */
export function DayDetail({
  date,
  today,
  tz,
  isHoliday,
  entries,
  employees,
  colors,
  audience,
  onOpenShift,
  actions,
  emptyText,
}: Props) {
  const visible = entries.filter(
    (e) => e.shifts.length || e.intervals.length || e.anomalies.length || e.locationFlags.length,
  );

  return (
    <section className="card day-detail" aria-labelledby="day-detail-title" aria-live="polite">
      <div className="day-head">
        <h2 id="day-detail-title" className="cap">
          {formatLongDate(date)}
        </h2>
        {date === today && <span className="badge ok">Hoy</span>}
        {isHoliday && <span className="badge warn">Feriado</span>}
      </div>

      {visible.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="entries">
          {visible.map((e) => {
            const emp = employees.get(e.employeeId);
            const overPlan = e.plannedMin > 0 && e.workedMin > e.plannedMin ? e.workedMin - e.plannedMin : 0;
            return (
              <li key={e.employeeId} className={`entry emp-c${colors.get(e.employeeId) ?? 0}`}>
                {audience === "owner" && (
                  <div className="entry-head">
                    <span className="avatar sm emp-avatar" aria-hidden="true">
                      {initials(emp?.name ?? "?")}
                    </span>
                    <strong>{emp?.name}</strong>
                  </div>
                )}

                <dl className="entry-grid">
                  <div>
                    <dt>Turno</dt>
                    <dd>
                      {e.shifts.length === 0 ? (
                        <span className="muted">Sin turno asignado</span>
                      ) : (
                        <span className="shift-pills">
                          {e.shifts.map((s) =>
                            onOpenShift ? (
                              <button
                                key={s.id}
                                type="button"
                                className={`shift-pill ${s.status === "DRAFT" ? "draft" : ""}`}
                                onClick={() => onOpenShift(s)}
                                aria-label={`${formatSpan(s.start, s.end, tz)}${s.status === "DRAFT" ? ", borrador" : ""}. Ver o quitar`}
                              >
                                {formatSpan(s.start, s.end, tz)}
                                {s.status === "DRAFT" && <span className="chip-tag">Borrador</span>}
                              </button>
                            ) : (
                              <span key={s.id} className="shift-pill static">
                                {formatSpan(s.start, s.end, tz)}
                              </span>
                            ),
                          )}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Marcado</dt>
                    <dd>
                      {e.intervals.length ? (
                        <span className="num">{e.intervals.map((iv) => formatSpan(iv.start, iv.end, tz)).join(" y ")}</span>
                      ) : (
                        <span className="muted">{date > today ? "—" : "Sin marcas completas"}</span>
                      )}
                    </dd>
                  </div>
                  {e.workedMin > 0 && (
                    <div>
                      <dt>Trabajado</dt>
                      <dd className="num">{formatMinutes(e.workedMin)}</dd>
                    </div>
                  )}
                </dl>

                {(e.extraMin > 0 || overPlan > 0 || e.attendance.length > 0) && (
                  <div className="actions">
                    {e.attendance.map((a) => (
                      <AttendanceBadge key={a.shiftId} result={a} />
                    ))}
                    {e.extraMin > 0 && (
                      <span className="badge warn">
                        <TrendingUp size={14} aria-hidden="true" />
                        {formatMinutes(e.extraMin)} extra
                      </span>
                    )}
                    {overPlan > 0 && (
                      <span className="badge neutral">{formatMinutes(overPlan)} más que el turno</span>
                    )}
                  </div>
                )}

                {e.locationFlags.map((f) => (
                  <p key={f.punchId} className="entry-warn small">
                    <MapPin size={16} aria-hidden="true" />
                    <span>{describeLocationFlag(f, tz)}</span>
                  </p>
                ))}

                {e.anomalies.map((a) => (
                  <p key={`${a.kind}-${a.at}`} className="entry-warn small">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>
                      <strong>{ANOMALY_LABEL[a.kind]}.</strong> {ANOMALY_HINT[a.kind][audience]}
                    </span>
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}
      {actions && <div className="actions">{actions}</div>}
    </section>
  );
}
