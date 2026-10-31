import { localDateKey, type PlannedShift } from "@turnos/core";
import { ANOMALY_LABEL, ATTENDANCE_LABEL, formatDateKey, formatMinutes, formatTime } from "../lib/format";
import type { Timesheet } from "../lib/timesheet";

interface Props {
  sheet: Timesheet;
  planned: readonly PlannedShift[];
  tzOffsetMinutes: number;
}

/**
 * Registro de horas de un empleado. Es el mismo componente en la vista del dueño y en la del empleado,
 * así los dos ven exactamente los mismos números.
 */
export function TimesheetView({ sheet, planned, tzOffsetMinutes: tz }: Props) {
  const { hours, intervals, anomalies, attendance, restViolations } = sheet;
  const days = Object.keys(hours.byDay).sort();
  const shiftById = new Map(planned.map((s) => [s.id, s]));

  return (
    <div className="stack">
      <section className="card">
        <h3>Total del período</h3>
        <dl className="totals">
          <div>
            <dt>Total</dt>
            <dd>{formatMinutes(hours.total.total)}</dd>
          </div>
          <div>
            <dt>Normales</dt>
            <dd>{formatMinutes(hours.total.normal)}</dd>
          </div>
          <div>
            <dt>Extra</dt>
            <dd>{formatMinutes(hours.total.extra)}</dd>
          </div>
          <div>
            <dt>Nocturnas</dt>
            <dd>{formatMinutes(hours.total.night)}</dd>
          </div>
          <div>
            <dt>Feriado</dt>
            <dd>{formatMinutes(hours.total.holiday)}</dd>
          </div>
        </dl>
        <p className="muted small">
          Categorías según reglas configuradas del comercio (supuestos, no asesoramiento legal).
        </p>
      </section>

      {anomalies.length > 0 && (
        <section className="card warn">
          <h3>Para revisar ({anomalies.length})</h3>
          <p className="muted small">
            Las resuelve el dueño. Una entrada sin salida no suma horas; un turno de más de 16 h se suma igual.
          </p>
          <ul>
            {anomalies.map((a) => (
              <li key={`${a.kind}-${a.punchId ?? a.at}`}>
                {ANOMALY_LABEL[a.kind]} — {formatDateKey(localDateKey(a.at, tz))} {formatTime(a.at, tz)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>Por día</h3>
        <table>
          <thead>
            <tr>
              <th>Día</th>
              <th>Tramos</th>
              <th className="num">Horas</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <td>{formatDateKey(day)}</td>
                <td>
                  {intervals
                    .filter((iv) => localDateKey(iv.start, tz) === day)
                    .map((iv) => {
                      const endDay = localDateKey(iv.end, tz);
                      // Un tramo que termina otro día lo dice, para que 09:00–21:45 no parezca de 12 h.
                      const suffix = endDay === day ? "" : ` (${formatDateKey(endDay)})`;
                      return `${formatTime(iv.start, tz)}–${formatTime(iv.end, tz)}${suffix}`;
                    })
                    .join(", ")}
                </td>
                <td className="num">{formatMinutes(hours.byDay[day]!.total)}</td>
              </tr>
            ))}
            {days.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Sin horas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {attendance.length > 0 && (
        <section className="card">
          <h3>Turnos planificados</h3>
          <ul className="plain">
            {attendance.map((r) => {
              const s = shiftById.get(r.shiftId);
              return (
                <li key={r.shiftId}>
                  {s && `${formatDateKey(localDateKey(s.start, tz))} ${formatTime(s.start, tz)}–${formatTime(s.end, tz)}`}{" "}
                  <span className={`badge ${r.status.toLowerCase()}`}>
                    {ATTENDANCE_LABEL[r.status]}
                    {r.status === "LATE" && ` (${r.lateMin} min)`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {restViolations.length > 0 && (
        <section className="card warn">
          <h3>Descanso entre jornadas menor al configurado</h3>
          <ul>
            {restViolations.map((v) => (
              <li key={v.previousEnd}>
                {formatDateKey(localDateKey(v.nextStart, tz))}: {formatMinutes(v.restMin)} de descanso
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
