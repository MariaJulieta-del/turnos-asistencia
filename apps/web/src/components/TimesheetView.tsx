import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, MapPin, Moon, Sun, TrendingUp } from "lucide-react";
import { localDateKey, type AttendanceResult, type Interval, type PlannedShift } from "@turnos/core";
import {
  ANOMALY_HINT,
  ANOMALY_LABEL,
  ATTENDANCE_LABEL,
  dateChip,
  describeLocationFlag,
  formatDateKey,
  formatMinutes,
  formatSpan,
  formatTime,
} from "../lib/format";
import type { Timesheet } from "../lib/timesheet";

interface Props {
  sheet: Timesheet;
  planned: readonly PlannedShift[];
  tzOffsetMinutes: number;
  /** Cambia los consejos de "Para revisar" según quién mira. */
  audience: "employee" | "owner";
  periodLabel: string;
}

interface DayRow {
  day: string;
  intervals: Interval[];
  minutes: number;
  attendance?: AttendanceResult;
  shift?: PlannedShift;
}

const ATTENDANCE_TONE = { ON_TIME: "ok", LATE: "warn", ABSENT: "danger" } as const;

/**
 * Registro de horas de un empleado. Es el mismo componente en la vista del dueño y en la del empleado,
 * así los dos ven exactamente los mismos números.
 */
export function TimesheetView({ sheet, planned, tzOffsetMinutes: tz, audience, periodLabel }: Props) {
  const { hours, intervals, anomalies, attendance, restViolations, locationFlags } = sheet;
  const shiftById = new Map(planned.map((s) => [s.id, s]));

  // Un día aparece si tiene horas o si tenía un turno planificado (para que se vean las ausencias).
  const rows = new Map<string, DayRow>();
  const rowFor = (day: string) => {
    let r = rows.get(day);
    if (!r) rows.set(day, (r = { day, intervals: [], minutes: 0 }));
    return r;
  };
  for (const [day, b] of Object.entries(hours.byDay)) rowFor(day).minutes = b.total;
  for (const iv of intervals) rowFor(localDateKey(iv.start, tz)).intervals.push(iv);
  for (const a of attendance) {
    const s = shiftById.get(a.shiftId);
    if (!s) continue;
    const r = rowFor(localDateKey(s.start, tz));
    r.attendance = a;
    r.shift = s;
  }
  const days = [...rows.values()].sort((a, b) => b.day.localeCompare(a.day));

  return (
    <div className="stack-lg">
      <section className="card" aria-labelledby="totals-title">
        <div className="stat-hero">
          <span id="totals-title" className="muted small">
            Horas trabajadas en {periodLabel}
          </span>
          <span className="value">{formatMinutes(hours.total.total)}</span>
        </div>
        <div className="stats">
          <Stat icon={<Sun size={14} />} label="Normales" value={hours.total.normal} />
          <Stat icon={<TrendingUp size={14} />} label="Extra" value={hours.total.extra} />
          <Stat icon={<Moon size={14} />} label="Nocturnas" value={hours.total.night} />
          <Stat icon={<CalendarClock size={14} />} label="Feriado" value={hours.total.holiday} />
        </div>
        <p className="muted small">
          Las categorías siguen las reglas cargadas para el comercio.{" "}
          <Link to="/ayuda#glosario">¿Qué significa cada una?</Link>
        </p>
      </section>

      {anomalies.length + locationFlags.length > 0 && (
        <section className="callout warn" aria-labelledby="review-title">
          <div className="callout-head">
            <AlertTriangle size={20} aria-hidden="true" />
            <h3 id="review-title">Para revisar ({anomalies.length + locationFlags.length})</h3>
          </div>
          <ul>
            {locationFlags.map((f) => (
              <li key={f.punchId} className="flag-item">
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <strong>{formatDateKey(localDateKey(f.at, tz))}</strong> · {describeLocationFlag(f, tz)}
                </span>
              </li>
            ))}
            {anomalies.map((a) => (
              <li key={`${a.kind}-${a.punchId ?? a.at}`}>
                <strong>{ANOMALY_LABEL[a.kind]}</strong>
                <span className="muted"> · {formatDateKey(localDateKey(a.at, tz))} {formatTime(a.at, tz)}</span>
                <p className="small">{ANOMALY_HINT[a.kind][audience]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {restViolations.length > 0 && (
        <section className="callout warn" aria-labelledby="rest-title">
          <div className="callout-head">
            <AlertTriangle size={20} aria-hidden="true" />
            <h3 id="rest-title">Poco descanso entre jornadas</h3>
          </div>
          <ul>
            {restViolations.map((v) => (
              <li key={v.previousEnd}>
                {formatDateKey(localDateKey(v.nextStart, tz))}: {formatMinutes(v.restMin)} de descanso
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack" aria-labelledby="days-title">
        <h3 id="days-title">Día por día</h3>
        {days.length === 0 ? (
          <p className="card muted">Todavía no hay marcas ni turnos en este período.</p>
        ) : (
          <ul className="list">
            {days.map((r) => {
              const chip = dateChip(r.day);
              return (
                <li key={r.day} className="row">
                  <div className="date-chip" aria-label={formatDateKey(r.day)}>
                    <span className="wd" aria-hidden="true">
                      {chip.weekday}
                    </span>
                    <span className="d" aria-hidden="true">
                      {chip.day}
                    </span>
                  </div>
                  <div className="row-main">
                    <span>
                      {r.intervals.length
                        ? r.intervals.map((iv) => formatSpan(iv.start, iv.end, tz)).join(", ")
                        : "Sin marcas completas"}
                    </span>
                    {r.shift && (
                      <span className="muted small">Turno {formatSpan(r.shift.start, r.shift.end, tz)}</span>
                    )}
                  </div>
                  <div className="row-end">
                    <span className="num">{formatMinutes(r.minutes)}</span>
                    {r.attendance && <AttendanceBadge result={r.attendance} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="stat">
      <span className="label">
        <span aria-hidden="true">{icon}</span>
        {label}
      </span>
      <span className="value">{formatMinutes(value)}</span>
    </div>
  );
}

export function AttendanceBadge({ result }: { result: AttendanceResult }) {
  const tone = ATTENDANCE_TONE[result.status];
  return (
    <span className={`badge ${tone}`}>
      {result.status === "ON_TIME" ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : (
        <AlertTriangle size={14} aria-hidden="true" />
      )}
      {ATTENDANCE_LABEL[result.status]}
      {result.status === "LATE" && ` ${result.lateMin} min`}
    </span>
  );
}
