import { useState, type FormEvent } from "react";
import type { Employee, NewShiftInput, ShiftTemplate } from "@turnos/contract";
import { formatHM, formatLongDate, formatMinutes, parseHM } from "../../lib/format";

interface Props {
  employees: Employee[];
  /** Fechas que se pueden elegir (la grilla visible del calendario). */
  dates: string[];
  templates: ShiftTemplate[];
  initialEmployeeId?: string;
  initialDate?: string;
  onCancel: () => void;
  /** Uno o dos tramos (horario cortado). Se guardan como borrador. */
  onSave: (inputs: NewShiftInput[]) => Promise<void>;
}

interface Segment {
  start: string;
  end: string;
}

function minutesOf(seg: Segment): { startMin: number; endMin: number; duration: number; crosses: boolean } | null {
  const startMin = parseHM(seg.start);
  const endMin = parseHM(seg.end);
  if (startMin === null || endMin === null) return null;
  const crosses = endMin <= startMin;
  return { startMin, endMin, crosses, duration: (crosses ? endMin + 1440 : endMin) - startMin };
}

/** Asignar un horario: de corrido (un tramo) o cortado (dos tramos el mismo día). */
export function ShiftForm({ employees, dates, templates, initialEmployeeId, initialDate, onCancel, onSave }: Props) {
  const first = templates[0];
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? employees[0]?.id ?? "");
  const [date, setDate] = useState(initialDate ?? dates[0] ?? "");
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
  const total = (ma?.duration ?? 0) + (mb?.duration ?? 0);

  function applyTemplate(t: ShiftTemplate) {
    setSplit(false);
    setA({ start: formatHM(t.startMin), end: formatHM(t.endMin) });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ma || (split && !mb)) {
      setError("Completá la hora de entrada y de salida de cada tramo.");
      return;
    }
    if (split && mb && (ma.crosses || mb.startMin < ma.endMin)) {
      setError("En un horario cortado, el segundo tramo tiene que empezar después de que termine el primero.");
      return;
    }
    if (!dates.includes(date)) {
      setError("Elegí un día del calendario que estás viendo.");
      return;
    }
    setSaving(true);
    setError(null);
    const inputs: NewShiftInput[] = [{ employeeId, date, startMin: ma.startMin, endMin: ma.endMin }];
    if (split && mb) inputs.push({ employeeId, date, startMin: mb.startMin, endMin: mb.endMin });
    try {
      await onSave(inputs);
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

      <div className="field">
        <label htmlFor="sf-date">Día</label>
        <input
          id="sf-date"
          type="date"
          value={date}
          min={dates[0]}
          max={dates.at(-1)}
          onChange={(e) => setDate(e.target.value)}
          aria-describedby="sf-date-hint"
          required
        />
        <span id="sf-date-hint" className="muted small cap">
          {date && formatLongDate(date)}
        </span>
      </div>

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
        {total > 0 && `Total: ${formatMinutes(total)}.`}
        {!split && ma?.crosses && " Termina al día siguiente."}
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
          {saving ? "Guardando…" : "Guardar borrador"}
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
