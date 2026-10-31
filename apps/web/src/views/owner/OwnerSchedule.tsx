import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Plus, Send } from "lucide-react";
import type { MonthSchedule, NewShiftsInput, ScheduledShift } from "@turnos/contract";
import { addMonths, localDateKey } from "@turnos/core";
import { DayDetail } from "../../components/DayDetail";
import { Modal } from "../../components/Modal";
import { MonthCalendar } from "../../components/MonthCalendar";
import { createShifts, fetchSchedule, publishSchedule, removeShift } from "../../lib/api";
import { buildCalendar, colorIndex, type DayEntry } from "../../lib/calendar";
import { formatDateKey, formatLongDate, formatMonth, formatSpan, initials } from "../../lib/format";
import { checkSchedule } from "../../lib/timesheet";
import { ShiftForm } from "./ShiftForm";

type Dialog = { kind: "new" } | { kind: "shift"; shift: ScheduledShift } | null;
const ALL = "todos";

/**
 * Calendario del dueño. Arriba un desplegable para ver a todo el equipo (cada uno con su color) o a un
 * empleado solo. Tocar un día muestra el detalle: turno asignado, lo marcado y las horas extra.
 */
export function OwnerSchedule({ token }: { token: string }) {
  const [params, setParams] = useSearchParams();
  const requestedMonth = params.get("mes") ?? undefined;
  const filter = params.get("empleado") ?? ALL;
  const [data, setData] = useState<MonthSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchSchedule(token, requestedMonth));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, requestedMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const calendar = useMemo(
    () =>
      data
        ? buildCalendar(data.employees, data.shifts, data.punches, data.business, Date.now())
        : new Map<string, DayEntry[]>(),
    [data],
  );

  if (error) return <p className="callout warn">{error}</p>;
  if (!data) {
    return (
      <p className="muted" role="status">
        Cargando el calendario…
      </p>
    );
  }

  const tz = data.business.tzOffsetMinutes;
  const today = localDateKey(Date.now(), tz);
  const isCurrentMonth = data.month === today.slice(0, 7);
  const day = selected && data.dates.includes(selected) ? selected : isCurrentMonth ? today : `${data.month}-01`;
  const employees = new Map(data.employees.map((e) => [e.id, e]));
  const colors = colorIndex(data.employees);
  const single = filter !== ALL && employees.has(filter);

  // Con un empleado elegido, el calendario y el detalle muestran solo lo suyo.
  const days = single
    ? new Map([...calendar].map(([d, entries]) => [d, entries.filter((e) => e.employeeId === filter)]))
    : calendar;
  const visibleShifts = single ? data.shifts.filter((s) => s.employeeId === filter) : data.shifts;
  const drafts = data.shifts.filter((s) => s.status === "DRAFT");
  const warnings = checkSchedule(visibleShifts, data.business.minRestMin, tz);

  function setParam(key: string, value: string | null) {
    setMessage("");
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  async function publish() {
    setPublishing(true);
    try {
      const { published } = await publishSchedule(token, { from: data!.dates[0]!, to: data!.dates.at(-1)! });
      setMessage(
        published === 1
          ? "Se publicó 1 turno. El empleado ya lo ve en su enlace."
          : `Se publicaron ${published} turnos. Los empleados ya los ven en su enlace.`,
      );
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
    setPublishing(false);
  }

  async function save(input: NewShiftsInput) {
    await createShifts(token, input);
    setDialog(null);
    const who = employees.get(input.employeeId)?.name;
    const where = input.dates.length === 1 ? "" : ` en ${input.dates.length} días`;
    setMessage(`Horario guardado como borrador para ${who}${where}. Publicalo cuando esté listo.`);
    setSelected(input.dates[0]!);
    await load();
  }

  return (
    <div className="stack-lg">
      <h1 className="visually-hidden">Horarios</h1>

      <div className="toolbar">
        <div className="month-nav">
          <button
            type="button"
            className="btn icon-btn"
            aria-label="Mes anterior"
            onClick={() => setParam("mes", addMonths(data.month, -1))}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h2 className="cap" aria-live="polite">
            {formatMonth(data.month)}
          </h2>
          <button
            type="button"
            className="btn icon-btn"
            aria-label="Mes siguiente"
            onClick={() => setParam("mes", addMonths(data.month, 1))}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          {!isCurrentMonth && (
            <button type="button" className="btn ghost" onClick={() => setParam("mes", today.slice(0, 7))}>
              Hoy
            </button>
          )}
        </div>
        <button type="button" className="btn primary" onClick={() => setDialog({ kind: "new" })}>
          <Plus size={20} aria-hidden="true" />
          Asignar horario
        </button>
      </div>

      <div className="filter-bar">
        <div className="field inline">
          <label htmlFor="emp-filter">Ver horario de</label>
          <div className="select-with-dot">
            {single && <span className={`dot-color emp-c${colors.get(filter)}`} aria-hidden="true" />}
            <select
              id="emp-filter"
              value={single ? filter : ALL}
              onChange={(e) => setParam("empleado", e.target.value === ALL ? null : e.target.value)}
            >
              <option value={ALL}>Todo el equipo</option>
              {data.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!single && (
          <ul className="emp-legend" aria-label="Colores por empleado (tocá uno para ver solo su horario)">
            {data.employees.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={`emp-tag emp-c${colors.get(e.id)}`}
                  onClick={() => setParam("empleado", e.id)}
                >
                  <span className="avatar sm emp-avatar" aria-hidden="true">
                    {initials(e.name)}
                  </span>
                  {e.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MonthCalendar
        month={data.month}
        dates={data.dates}
        today={today}
        tz={tz}
        holidays={data.business.holidays}
        days={days}
        employees={employees}
        colors={colors}
        selected={day}
        onSelect={(d) => {
          setSelected(d);
          setMessage("");
        }}
        mode={single ? "single" : "team"}
      />

      <p className="muted small legend">
        <span className="legend-item">
          <span className="swatch published" aria-hidden="true" /> Publicado
        </span>
        <span className="legend-item">
          <span className="swatch draft" aria-hidden="true" /> Borrador (el empleado todavía no lo ve)
        </span>
        <span className="legend-item">
          <span className="cal-extra static">+2h</span> Horas extra
        </span>
      </p>

      <p className="small" role="status" aria-live="polite">
        {message}
      </p>

      <DayDetail
        date={day}
        today={today}
        tz={tz}
        isHoliday={data.business.holidays.includes(day)}
        entries={days.get(day) ?? []}
        employees={employees}
        colors={colors}
        audience="owner"
        onOpenShift={(shift) => setDialog({ kind: "shift", shift })}
        emptyText="No hay horarios para este día."
        actions={
          <button type="button" className="btn" onClick={() => setDialog({ kind: "new" })}>
            <Plus size={18} aria-hidden="true" />
            Asignar horario el {formatDateKey(day)}
          </button>
        }
      />

      {drafts.length > 0 ? (
        <section className="callout info" aria-labelledby="drafts-title">
          <h2 id="drafts-title" className="callout-title">
            {drafts.length === 1 ? "1 horario en borrador" : `${drafts.length} horarios en borrador`}
          </h2>
          <p className="small">Los empleados todavía no los ven. Cuando esté listo, publicalo.</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={publish} disabled={publishing}>
              <Send size={18} aria-hidden="true" />
              {publishing ? "Publicando…" : "Publicar horarios"}
            </button>
          </div>
        </section>
      ) : (
        data.shifts.length > 0 && (
          <p className="sync ok small">
            <CheckCircle2 size={16} aria-hidden="true" />
            Todo publicado: los empleados ven sus horarios.
          </p>
        )
      )}

      {warnings.length > 0 && (
        <section className="callout warn" aria-labelledby="warn-title">
          <div className="callout-head">
            <AlertTriangle size={20} aria-hidden="true" />
            <h2 id="warn-title" className="callout-title">
              Revisá antes de publicar
            </h2>
          </div>
          <ul>
            {warnings.map((w) => (
              <li key={`${w.employeeId}-${w.at}`} className="small">
                <strong>{employees.get(w.employeeId)?.name}</strong>, {formatDateKey(localDateKey(w.at, tz))}:{" "}
                {w.kind === "overlap"
                  ? "tiene dos horarios que se superponen."
                  : `descansa solo ${Math.floor(w.restMin / 60)} h entre una jornada y la siguiente (lo configurado es ${Math.floor(data.business.minRestMin / 60)} h).`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog?.kind === "new" && (
        <Modal title="Asignar horario" onClose={() => setDialog(null)}>
          <ShiftForm
            employees={data.employees}
            month={data.month}
            dates={data.dates}
            templates={data.templates}
            initialEmployeeId={single ? filter : undefined}
            initialDate={day}
            onCancel={() => setDialog(null)}
            onSave={save}
          />
        </Modal>
      )}

      {dialog?.kind === "shift" && (
        <ShiftDetails
          shift={dialog.shift}
          tz={tz}
          name={employees.get(dialog.shift.employeeId)?.name ?? "?"}
          onClose={() => setDialog(null)}
          onRemove={async () => {
            const result = await removeShift(token, dialog.shift.id);
            setDialog(null);
            setMessage(result === "deleted" ? "Borrador eliminado." : "Horario cancelado. El empleado ya no lo ve.");
            await load();
          }}
        />
      )}
    </div>
  );
}

function ShiftDetails({
  shift,
  tz,
  name,
  onClose,
  onRemove,
}: {
  shift: ScheduledShift;
  tz: number;
  name: string;
  onClose: () => void;
  onRemove: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = shift.status === "DRAFT";

  return (
    <Modal title={name} onClose={onClose}>
      <dl className="details">
        <div>
          <dt>Día</dt>
          <dd>{formatLongDate(localDateKey(shift.start, tz))}</dd>
        </div>
        <div>
          <dt>Horario</dt>
          <dd className="num">{formatSpan(shift.start, shift.end, tz)}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{draft ? "Borrador (el empleado todavía no lo ve)" : "Publicado (el empleado lo ve)"}</dd>
        </div>
      </dl>
      <p className="muted small">
        {draft
          ? "Para cambiar el horario, quitá este borrador y asigná uno nuevo."
          : "Si lo cancelás, desaparece del horario del empleado. Avisale del cambio."}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Volver
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRemove();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {draft ? "Quitar borrador" : "Cancelar horario"}
        </button>
      </div>
    </Modal>
  );
}
