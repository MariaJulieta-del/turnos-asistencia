import { useState, type FormEvent } from "react";
import type { Employee, NewShiftsInput, ShiftTemplate } from "@turnos/contract";
import { formatHM, formatLongDate, formatMinutes, parseHM } from "../../lib/format";

interface Props {
  employees: Employee[];
  /** "YYYY-MM" del calendario visible. */
  month: string;
  /** Grilla visible del calendario (semanas completas de lunes a domingo). */
  dates: string[];
  templates: ShiftTemplate[];
  initialEmployeeId?: string;
  initialDate?: string;
  onCancel: () => void;
  /** El mismo horario (uno o dos tramos) en todos los días elegidos. Se guarda como borrador. */
  onSave: (input: NewShiftsInput) => Promise<void>;
}

interface Segment {
  start: string;
  end: string;
}

const HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

function minutesOf(seg: Segment): { startMin: number; endMin: number; duration: number; crosses: boolean } | null {
  const startMin = parseHM(seg.start);
  const endMin = parseHM(seg.end);
  if (startMin === null || endMin === null) return null;
  const crosses = endMin <= startMin;
  return { startMin, endMin, crosses, duration: (crosses ? endMin + 1440 : endMin) - startMin };
}

/**
 * Asignar un horario: de corrido (un tramo) o cortado (dos tramos), en uno o varios días a la vez.
 * La grilla empieza en lunes, así la posición en la semana sale del índice.
 */
export function ShiftForm({ employees, month, dates, templates, initialEmployeeId, initialDate, onCancel, onSave }: Props) {
  const first = templates[0];
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? employees[0]?.id ?? "");
  const [days, setDays] = useState<Set<string>>(() => new Set(initialDate && dates.includes(initialDate) ? [initialDate] : []));
  const [split, setSplit] = useState(false);
  const [a, setA] = useState<Segment>({
    start: first ? formatHM(first.startMin) : "09:00",
    end: first ? formatHM(first.endMin) : "17:00",
  });
  const [b, setB] = useState<Segment>({ start: "17:00", end: "21:00" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ma = minutesOf(a);
  const mb = split ? minutesOf(b) : null;
  const perDay = (ma?.duration ?? 0) + (mb?.duration ?? 0);

  // Semana de referencia para los atajos: la del primer día elegido, o la del día desde el que se abrió.
  const anchor = [...days].sort()[0] ?? initialDate ?? dates.find((d) => d.startsWith(month)) ?? dates[0]!;
  const anchorWeek = Math.floor(Math.max(0, dates.indexOf(anchor)) / 7);
  const weekOf = (i: number) => Math.floor(i / 7);
  const isWeekday = (i: number) => i % 7 < 5;

  function toggle(date: string) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  const pick = (filter: (d: string, i: number) => boolean) => setDays(new Set(dates.filter(filter)));

  function applyTemplate(t: ShiftTemplate) {
    setSplit(false);
    setA({ start: formatHM(t.startMin), end: formatHM(t.endMin) });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (days.size === 0) {
      setError("Elegí al menos un día.");
      return;
    }
    if (!ma || (split && !mb)) {
      setError("Completá la hora de entrada y de salida de cada tramo.");
      return;
    }
    if (split && mb && (ma.crosses || mb.startMin < ma.endMin)) {
      setError("En un horario cortado, el segundo tramo tiene que empezar después de que termine el primero.");
      return;
    }
    setSaving(true);
    setError(null);
    const segments = [{ startMin: ma.startMin, endMin: ma.endMin }];
    if (split && mb) segments.push({ startMin: mb.startMin, endMin: mb.endMin });
    try {
      await onSave({ employeeId, dates: [...days].sort(), segments });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="sf-employee">Empleado</label>
        <select id="sf-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="field">
        <legend>
          Días <span className="muted small">· tocá todos los que lleven este horario</span>
        </legend>
        <div className="chips">
          <button
            type="button"
            className="chip"
            onClick={() => pick((d, i) => weekOf(i) === anchorWeek && isWeekday(i))}
          >
            Lun a vie de esa semana
          </button>
          <button type="button" className="chip" onClick={() => pick((d, i) => d.startsWith(month) && isWeekday(i))}>
            Lun a vie de todo el mes
          </button>
          <button type="button" className="chip" onClick={() => pick((d, i) => weekOf(i) === anchorWeek)}>
            Toda esa semana
          </button>
          {days.size > 0 && (
            <button type="button" className="chip" onClick={() => setDays(new Set())}>
              Limpiar
            </button>
          )}
        </div>
        <div className="day-picker" role="group" aria-label="Días del calendario">
          {HEADERS.map((h, i) => (
            <span key={i} className="dp-head" aria-hidden="true">
              {h}
            </span>
          ))}
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              className={`dp-day ${d.startsWith(month) ? "" : "outside"}`}
              aria-pressed={days.has(d)}
              aria-label={formatLongDate(d)}
              onClick={() => toggle(d)}
            >
              {Number(d.slice(8))}
            </button>
          ))}
        </div>
        <p className="muted small" aria-live="polite">
          {days.size === 0
            ? "Ningún día elegido."
            : days.size === 1
              ? `Elegiste el ${formatLongDate([...days][0]!)}.`
              : `${days.size} días elegidos.`}
        </p>
      </fieldset>

      {templates.length > 0 && (
        <fieldset className="field">
          <legend>Horarios frecuentes</legend>
          <div className="chips">
            {templates.map((t) => {
              const active = !split && ma?.startMin === t.startMin && ma?.endMin === t.endMin;
              return (
                <button key={t.id} type="button" className="chip" aria-pressed={active} onClick={() => applyTemplate(t)}>
                  <strong>{t.name}</strong> {formatHM(t.startMin)}–{formatHM(t.endMin)}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="field">
        <legend>Tipo de horario</legend>
        <div className="segmented">
          <label>
            <input type="radio" name="sf-kind" checked={!split} onChange={() => setSplit(false)} />
            De corrido
          </label>
          <label>
            <input
              type="radio"
              name="sf-kind"
              checked={split}
              onChange={() => {
                setSplit(true);
                // Punto de partida típico de un cortado, si no queda pausa entre el primer tramo y el segundo.
                const end = parseHM(a.end);
                const bStart = parseHM(b.start);
                if (end === null || bStart === null || end >= bStart) setA({ start: "09:00", end: "13:00" });
              }}
            />
            Cortado (dos tramos)
          </label>
        </div>
      </fieldset>

      <SegmentFields id="a" label={split ? "Primer tramo" : undefined} value={a} onChange={setA} />
      {split && <SegmentFields id="b" label="Segundo tramo" value={b} onChange={setB} />}

      <p className="muted small" aria-live="polite">
        {perDay > 0 && `${formatMinutes(perDay)} por día.`}
        {!split && ma?.crosses && " Termina al día siguiente."}
        {days.size > 1 && perDay > 0 && ` En total, ${formatMinutes(perDay * days.size)}.`}
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Guardando…" : days.size > 1 ? `Guardar en ${days.size} días` : "Guardar borrador"}
        </button>
      </div>
    </form>
  );
}

function SegmentFields({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label?: string;
  value: Segment;
  onChange: (s: Segment) => void;
}) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="field-row">
        <div className="field">
          <label htmlFor={`sf-${id}-start`}>Entrada</label>
          <input
            id={`sf-${id}-start`}
            type="time"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`sf-${id}-end`}>Salida</label>
          <input
            id={`sf-${id}-end`}
            type="time"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            required
          />
        </div>
      </div>
    </div>
  );
}
