import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, CloudOff, LogIn, LogOut } from "lucide-react";
import { localDateKey, monthGridDates, type Punch } from "@turnos/core";
import { AppShell } from "../components/AppShell";
import { DayDetail } from "../components/DayDetail";
import { FirstVisitTip } from "../components/FirstVisitTip";
import { MonthCalendar } from "../components/MonthCalendar";
import { TimesheetView } from "../components/TimesheetView";
import { buildCalendar, colorIndex } from "../lib/calendar";
import { DEMO_MODE, fetchEmployeeSnapshot, sendPunch, type EmployeeSnapshot } from "../lib/api";
import { formatDateKey, formatLongDate, formatMonth, formatSpan, formatTime } from "../lib/format";
import { punchQueue } from "../lib/localQueue";
import { newPunch } from "../lib/punchQueue";
import { buildTimesheet, lastPunch, nextPunchType } from "../lib/timesheet";

const HELP = "/ayuda#empleado";

/** Vista del empleado: fichar, ver su horario y su propio registro con el mismo cálculo que ve el dueño. */
export function EmployeeView() {
  const { token = "" } = useParams();
  const [data, setData] = useState<EmployeeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Punch[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const hasData = useRef(false);

  /**
   * Envía la cola y recarga. Primero los datos del servidor y después la cola: así una marca recién
   * enviada nunca desaparece de la pantalla entre que sale de la cola y llega en el snapshot.
   */
  const sync = useCallback(async () => {
    await punchQueue.flush((p) => sendPunch(token, p));
    try {
      setData(await fetchEmployeeSnapshot(token));
      hasData.current = true;
    } catch (e) {
      // Sin señal se sigue mostrando lo último que se cargó.
      if (!hasData.current) setError((e as Error).message);
    }
    setPending(await punchQueue.pending());
  }, [token]);

  useEffect(() => {
    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [sync]);

  // Las marcas sin enviar ya cuentan en pantalla; pairPunches deduplica por id si el servidor también las tiene.
  const punches = useMemo(() => [...(data?.punches ?? []), ...pending], [data, pending]);

  if (error) {
    return (
      <AppShell helpHref={HELP}>
        <p className="callout warn">{error}</p>
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell helpHref={HELP}>
        <p className="muted" role="status">
          Cargando tu horario…
        </p>
      </AppShell>
    );
  }

  const { me, business, planned } = data;
  const tz = business.tzOffsetMinutes;
  const now = Date.now();
  const today = localDateKey(now, tz);
  const next = nextPunchType(punches, me.id);
  const last = lastPunch(punches, me.id);
  const sheet = buildTimesheet(me.id, punches, planned, business, now);
  const myPending = pending.filter((p) => p.employeeId === me.id);
  const mine = planned.filter((s) => s.employeeId === me.id).sort((a, b) => a.start - b.start);
  const todayShift = mine.find((s) => localDateKey(s.start, tz) === today);
  const upcoming = mine.filter((s) => s.start > now);

  // Calendario: los turnos que ve el empleado ya están publicados.
  const gridDates = monthGridDates(data.month);
  const employeeMap = new Map([[me.id, me]]);
  const colors = colorIndex([me]);
  const calendar = buildCalendar(
    [me],
    planned.map((s) => ({ ...s, status: "PUBLISHED" as const })),
    punches,
    business,
    now,
  );
  const selectedDay = selected && gridDates.includes(selected) ? selected : today;

  async function punch() {
    setBusy(true);
    const p = newPunch(me.id, next);
    await punchQueue.enqueue(p);
    setPending(await punchQueue.pending());
    setFeedback(`${p.type === "IN" ? "Entrada" : "Salida"} marcada a las ${formatTime(p.at, tz)}.`);
    setBusy(false);
    void sync();
  }

  const working = next === "OUT" && last;
  const sinceLabel =
    working && localDateKey(last.at, tz) !== today
      ? `${formatDateKey(localDateKey(last.at, tz))} a las ${formatTime(last.at, tz)}`
      : working
        ? `las ${formatTime(last.at, tz)}`
        : "";

  return (
    <AppShell helpHref={HELP}>
      <header className="page-head">
        <h1>Hola, {me.name.split(" ")[0]}</h1>
        <p className="muted">{formatLongDate(today)}</p>
      </header>

      <FirstVisitTip id="empleado" title="¿Primera vez? Así se usa" helpHref={HELP}>
        <ol className="tip-list">
          <li>Al llegar, tocá <strong>Marcar entrada</strong>. Al irte, <strong>Marcar salida</strong>.</li>
          <li>Si no hay señal, la marca se guarda en el celular y se envía sola después.</li>
          <li>
            En <strong>Mi calendario</strong> ves tu horario de cada día y, a medida que marcás, lo trabajado y las horas
            extra. Tocá un día para ver el detalle. Son los mismos números que ve el dueño.
          </li>
        </ol>
      </FirstVisitTip>

      <section className="card" aria-labelledby="punch-title">
        <h2 id="punch-title" className="visually-hidden">
          Fichar
        </h2>
        <div className="status-line">
          <span className={`dot ${working ? "on" : "off"}`} aria-hidden="true" />
          <span>{working ? `Estás trabajando desde ${sinceLabel}` : "No estás trabajando ahora"}</span>
        </div>
        <p className="muted">
          {todayShift ? (
            <>
              Tu turno de hoy: <strong className="num">{formatSpan(todayShift.start, todayShift.end, tz)}</strong>
            </>
          ) : (
            "Hoy no tenés turno asignado."
          )}
        </p>
        <button type="button" className={`punch-btn ${next === "IN" ? "in" : "out"}`} onClick={punch} disabled={busy}>
          {next === "IN" ? <LogIn size={26} aria-hidden="true" /> : <LogOut size={26} aria-hidden="true" />}
          {next === "IN" ? "Marcar entrada" : "Marcar salida"}
        </button>
        <p className="small" role="status" aria-live="polite">
          {feedback}
        </p>
        {myPending.length > 0 ? (
          <p className="sync warn small">
            <CloudOff size={16} aria-hidden="true" />
            {myPending.length === 1
              ? "1 marca guardada en el celular. Se envía sola cuando haya señal."
              : `${myPending.length} marcas guardadas en el celular. Se envían solas cuando haya señal.`}
            {DEMO_MODE && " (Modo demo: no hay servidor, quedan acá.)"}
          </p>
        ) : (
          <p className="sync ok small">
            <CheckCircle2 size={16} aria-hidden="true" />
            Todas tus marcas están enviadas.
          </p>
        )}
      </section>

      <section className="stack" aria-labelledby="cal-title">
        <div className="section-title">
          <h2 id="cal-title">Mi calendario</h2>
          <span className="muted small cap">{formatMonth(data.month)}</span>
        </div>
        {upcoming[0] && (
          <p className="muted small">
            Próximo turno:{" "}
            <strong className="cap">
              {formatLongDate(localDateKey(upcoming[0].start, tz))}, {formatSpan(upcoming[0].start, upcoming[0].end, tz)}
            </strong>
          </p>
        )}
        <MonthCalendar
          month={data.month}
          dates={gridDates}
          today={today}
          tz={tz}
          holidays={business.holidays}
          days={calendar}
          employees={employeeMap}
          colors={colors}
          selected={selectedDay}
          onSelect={setSelected}
          mode="single"
        />
        <DayDetail
          date={selectedDay}
          today={today}
          tz={tz}
          isHoliday={business.holidays.includes(selectedDay)}
          entries={calendar.get(selectedDay) ?? []}
          employees={employeeMap}
          colors={colors}
          audience="employee"
          emptyText={selectedDay < today ? "No trabajaste ni tenías turno este día." : "Día libre."}
        />
      </section>

      <section className="stack" aria-labelledby="month-title">
        <h2 id="month-title">Mi mes</h2>
        <TimesheetView
          sheet={sheet}
          planned={planned}
          tzOffsetMinutes={tz}
          audience="employee"
          periodLabel={formatMonth(data.month)}
        />
      </section>
    </AppShell>
  );
}
