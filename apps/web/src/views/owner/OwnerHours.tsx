import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { TimesheetView } from "../../components/TimesheetView";
import { fetchOwnerSnapshot, type Snapshot } from "../../lib/api";
import { formatMinutes, formatMonth, initials } from "../../lib/format";
import { buildTimesheet } from "../../lib/timesheet";

/** Horas del mes por empleado. Al tocar uno se ve el mismo registro que ve ese empleado. */
export function OwnerHours({ token, base }: { token: string; base: string }) {
  const [params] = useSearchParams();
  const selected = params.get("e");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOwnerSnapshot(token).then(setData, (e: Error) => setError(e.message));
  }, [token]);

  const sheets = useMemo(
    () =>
      data?.employees.map((e) => ({
        employee: e,
        sheet: buildTimesheet(e.id, data.punches, data.planned, data.business, Date.now()),
      })) ?? [],
    [data],
  );

  if (error) return <p className="callout warn">{error}</p>;
  if (!data) {
    return (
      <p className="muted" role="status">
        Cargando horas…
      </p>
    );
  }

  const month = formatMonth(data.month);
  const current = sheets.find((s) => s.employee.id === selected);

  if (current) {
    return (
      <div className="stack-lg">
        <Link to={`${base}?vista=horas`} className="btn ghost back-link">
          <ChevronLeft size={20} aria-hidden="true" />
          Todo el equipo
        </Link>
        <header className="page-head">
          <h1>{current.employee.name}</h1>
          <p className="muted">Lo mismo que ve en su enlace.</p>
        </header>
        <TimesheetView
          sheet={current.sheet}
          planned={data.planned}
          tzOffsetMinutes={data.business.tzOffsetMinutes}
          audience="owner"
          periodLabel={month}
        />
      </div>
    );
  }

  const teamTotal = sheets.reduce((acc, s) => acc + s.sheet.hours.total.total, 0);
  const toReview = sheets.reduce((acc, s) => acc + s.sheet.anomalies.length, 0);

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1>Horas del equipo</h1>
        <p className="muted">Mes de {month}</p>
      </header>

      <section className="card">
        <div className="stats two">
          <div className="stat">
            <span className="label">Total del equipo</span>
            <span className="value">{formatMinutes(teamTotal)}</span>
          </div>
          <div className="stat">
            <span className="label">Para revisar</span>
            <span className="value">{toReview}</span>
          </div>
        </div>
      </section>

      <ul className="list" aria-label="Empleados">
        {sheets.map(({ employee, sheet }) => (
          <li key={employee.id}>
            <Link to={`${base}?vista=horas&e=${employee.id}`} className="row row-link">
              <span className="avatar" aria-hidden="true">
                {initials(employee.name)}
              </span>
              <span className="row-main">
                <span>{employee.name}</span>
                <span className="muted small">
                  Extra {formatMinutes(sheet.hours.total.extra)} · Nocturnas {formatMinutes(sheet.hours.total.night)}
                </span>
              </span>
              <span className="row-end">
                <span className="num">{formatMinutes(sheet.hours.total.total)}</span>
                {sheet.anomalies.length > 0 ? (
                  <span className="badge warn">
                    <AlertTriangle size={14} aria-hidden="true" />
                    {sheet.anomalies.length} a revisar
                  </span>
                ) : (
                  <span className="badge ok">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Al día
                  </span>
                )}
              </span>
              <ChevronRight size={20} className="chevron" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
