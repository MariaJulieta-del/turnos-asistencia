import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Moon,
  TrendingUp,
} from "lucide-react";
import { addMonths, localDateKey } from "@turnos/core";
import { TimesheetView } from "../../components/TimesheetView";
import { fetchOwnerSnapshot, type Snapshot } from "../../lib/api";
import { colorIndex } from "../../lib/calendar";
import { formatLongDate, formatMinutes, formatMonth, formatSpan, initials } from "../../lib/format";
import { summarize, teamTotals, type EmployeeSummary } from "../../lib/summary";
import { buildTimesheet } from "../../lib/timesheet";

/**
 * Recuento del equipo: una card desplegable por empleado con horas, horas extra, asistencia y próximos
 * horarios. "Ver día por día" abre el mismo registro que ve ese empleado.
 */
export function OwnerTeam({ token, base }: { token: string; base: string }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("e");
  const month = params.get("mes") ?? undefined;
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setData(null);
    fetchOwnerSnapshot(token, month).then(setData, (e: Error) => setError(e.message));
  }, [token, month]);

  const rows = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return data.employees.map((employee) => {
      const sheet = buildTimesheet(employee.id, data.punches, data.planned, data.business, now);
      return { employee, sheet, summary: summarize(sheet, data.planned, now) };
    });
  }, [data]);

  if (error) return <p className="callout warn">{error}</p>;
  if (!data) {
    return (
      <p className="muted" role="status">
        Cargando el equipo…
      </p>
    );
  }

  const tz = data.business.tzOffsetMinutes;
  const monthLabel = formatMonth(data.month);
  const colors = colorIndex(data.employees);
  const totals = teamTotals(rows.map((r) => r.summary));
  const current = rows.find((r) => r.employee.id === selected);
  const link = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ vista: "equipo", ...(month ? { mes: month } : {}), ...extra });
    return `${base}?${p}`;
  };

  function goMonth(m: string) {
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set("mes", m);
      next.delete("e");
      return next;
    });
  }

  if (current) {
    return (
      <div className="stack-lg">
        <Link to={link({})} className="btn ghost back-link">
          <ChevronLeft size={20} aria-hidden="true" />
          Todo el equipo
        </Link>
        <header className="page-head">
          <h1>{current.employee.name}</h1>
          <p className="muted">Día por día de {monthLabel}. Es lo mismo que ve en su enlace.</p>
        </header>
        <TimesheetView sheet={current.sheet} planned={data.planned} tzOffsetMinutes={tz} audience="owner" periodLabel={monthLabel} />
      </div>
    );
  }

  const allOpen = rows.length > 0 && rows.every((r) => open.has(r.employee.id));
  const toggle = (id: string, isOpen: boolean) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="stack-lg">
      <h1 className="visually-hidden">Equipo</h1>

      <div className="toolbar">
        <div className="month-nav">
          <button type="button" className="btn icon-btn" aria-label="Mes anterior" onClick={() => goMonth(addMonths(data.month, -1))}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h2 className="cap" aria-live="polite">
            {monthLabel}
          </h2>
          <button type="button" className="btn icon-btn" aria-label="Mes siguiente" onClick={() => goMonth(addMonths(data.month, 1))}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setOpen(allOpen ? new Set() : new Set(rows.map((r) => r.employee.id)))}
        >
          {allOpen ? "Cerrar todas" : "Abrir todas"}
        </button>
      </div>

      <section className="card" aria-label={`Totales del equipo en ${monthLabel}`}>
        <div className="stats">
          <TeamStat icon={<Clock size={14} />} label="Horas del equipo" value={formatMinutes(totals.workedMin)} />
          <TeamStat icon={<TrendingUp size={14} />} label="Horas extra" value={formatMinutes(totals.extraMin)} />
          <TeamStat icon={<ListChecks size={14} />} label="Tardanzas · Ausencias" value={`${totals.late} · ${totals.absent}`} />
          <TeamStat icon={<AlertTriangle size={14} />} label="Para revisar" value={String(totals.toReview)} />
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="card muted">Todavía no hay empleados cargados.</p>
      ) : (
        <ul className="team-cards">
          {rows.map(({ employee, summary }) => (
            <li key={employee.id}>
              <details
                className={`team-card emp-c${colors.get(employee.id) ?? 0}`}
                open={open.has(employee.id)}
                onToggle={(e) => toggle(employee.id, (e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary>
                  <span className="avatar emp-avatar" aria-hidden="true">
                    {initials(employee.name)}
                  </span>
                  <span className="row-main">
                    <strong>{employee.name}</strong>
                    <span className="muted small">
                      {summary.shifts === 0
                        ? "Sin horarios publicados"
                        : `${summary.shifts} ${summary.shifts === 1 ? "turno" : "turnos"} en el mes`}
                    </span>
                    <span className="badges start">
                      {summary.extraMin > 0 && (
                        <span className="badge warn">
                          <TrendingUp size={14} aria-hidden="true" />
                          {formatMinutes(summary.extraMin)}
                        </span>
                      )}
                      {summary.toReview > 0 ? (
                        <span className="badge warn">
                          <AlertTriangle size={14} aria-hidden="true" />
                          {summary.toReview} a revisar
                        </span>
                      ) : (
                        <span className="badge ok">
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Al día
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="team-total">
                    <span className="num">{formatMinutes(summary.workedMin)}</span>
                    <span className="muted small">trabajadas</span>
                  </span>
                  <ChevronDown size={20} className="chevron disclosure" aria-hidden="true" />
                </summary>

                <EmployeeCardBody
                  summary={summary}
                  tz={tz}
                  dayByDayHref={link({ e: employee.id })}
                  calendarHref={`${base}?${new URLSearchParams({ ...(month ? { mes: month } : {}), empleado: employee.id })}`}
                />
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="stat">
      <span className="label">
        <span aria-hidden="true">{icon}</span>
        {label}
      </span>
      <span className="value">{value}</span>
    </div>
  );
}

function EmployeeCardBody({
  summary: s,
  tz,
  dayByDayHref,
  calendarHref,
}: {
  summary: EmployeeSummary;
  tz: number;
  dayByDayHref: string;
  calendarHref: string;
}) {
  const diff = s.workedMin - s.plannedPastMin;
  const evaluated = s.onTime + s.late + s.absent;

  return (
    <div className="team-card-body">
      <section aria-label="Horas">
        <h3 className="body-title">Horas</h3>
        <div className="stats">
          <div className="stat">
            <span className="label">Trabajadas</span>
            <span className="value">{formatMinutes(s.workedMin)}</span>
          </div>
          <div className="stat">
            <span className="label">Normales</span>
            <span className="value">{formatMinutes(s.normalMin)}</span>
          </div>
          <div className="stat">
            <span className="label">
              <TrendingUp size={14} aria-hidden="true" /> Extra
            </span>
            <span className="value">{formatMinutes(s.extraMin)}</span>
          </div>
          <div className="stat">
            <span className="label">
              <Moon size={14} aria-hidden="true" /> Nocturnas
            </span>
            <span className="value">{formatMinutes(s.nightMin)}</span>
          </div>
        </div>
        {s.plannedPastMin > 0 && (
          <p className="muted small">
            Turnos ya cumplidos: {formatMinutes(s.plannedPastMin)} planificadas.{" "}
            {diff === 0
              ? "Trabajó exactamente eso."
              : diff > 0
                ? `Trabajó ${formatMinutes(diff)} más.`
                : `Trabajó ${formatMinutes(-diff)} menos.`}
          </p>
        )}
        {s.holidayMin > 0 && <p className="muted small">Incluye {formatMinutes(s.holidayMin)} en feriado.</p>}
      </section>

      <section aria-label="Asistencia">
        <h3 className="body-title">Asistencia</h3>
        {evaluated === 0 ? (
          <p className="muted small">Todavía no terminó ningún turno publicado este mes.</p>
        ) : (
          <div className="badges">
            <span className="badge ok">
              <CheckCircle2 size={14} aria-hidden="true" />
              {s.onTime} {s.onTime === 1 ? "puntual" : "puntuales"}
            </span>
            <span className={`badge ${s.late ? "warn" : "neutral"}`}>
              {s.late} {s.late === 1 ? "tarde" : "tardes"}
              {s.late > 0 && ` (${formatMinutes(s.lateMin)} en total)`}
            </span>
            <span className={`badge ${s.absent ? "danger" : "neutral"}`}>
              {s.absent} {s.absent === 1 ? "ausencia" : "ausencias"}
            </span>
          </div>
        )}
      </section>

      <section aria-label="Próximos horarios">
        <h3 className="body-title">Próximos horarios</h3>
        {s.upcomingShifts.length === 0 ? (
          <p className="muted small">No tiene horarios publicados por delante en este mes.</p>
        ) : (
          <ul className="next-shifts">
            {s.upcomingShifts.slice(0, 5).map((sh) => (
              <li key={sh.id}>
                <span className="cap">{formatLongDate(localDateKey(sh.start, tz))}</span>
                <span className="num">{formatSpan(sh.start, sh.end, tz)}</span>
              </li>
            ))}
            {s.upcomingShifts.length > 5 && (
              <li className="muted small">y {s.upcomingShifts.length - 5} más en el mes</li>
            )}
          </ul>
        )}
      </section>

      {s.toReview > 0 && (
        <p className="sync warn small">
          <AlertTriangle size={16} aria-hidden="true" />
          {s.toReview === 1 ? "Hay 1 cosa para revisar" : `Hay ${s.toReview} cosas para revisar`} (marcas incompletas o
          fichadas fuera del local). Están en «Ver día por día».
        </p>
      )}

      <div className="actions">
        <Link to={dayByDayHref} className="btn">
          <ListChecks size={18} aria-hidden="true" />
          Ver día por día
        </Link>
        <Link to={calendarHref} className="btn ghost">
          <CalendarDays size={18} aria-hidden="true" />
          Ver en el calendario
        </Link>
      </div>
    </div>
  );
}
