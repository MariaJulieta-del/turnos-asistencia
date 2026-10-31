import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, CloudOff, LogIn, LogOut, MapPin } from "lucide-react";
import type { PunchInput } from "@turnos/contract";
import { checkGeofence, localDateKey, monthGridDates, type Punch } from "@turnos/core";
import { AppShell } from "../components/AppShell";
import { DayDetail } from "../components/DayDetail";
import { FirstVisitTip } from "../components/FirstVisitTip";
import { Modal } from "../components/Modal";
import { MonthCalendar } from "../components/MonthCalendar";
import { TimesheetView } from "../components/TimesheetView";
import { buildCalendar, colorIndex } from "../lib/calendar";
import { DEMO_MODE, fetchEmployeeSnapshot, sendPunch, type EmployeeSnapshot } from "../lib/api";
import { formatDateKey, formatDistance, formatLongDate, formatMonth, formatSpan, formatTime } from "../lib/format";
import { POSITION_ERROR_TEXT, currentPosition, getConsent, setConsent, type GeoConsent } from "../lib/geo";
import { punchQueue } from "../lib/localQueue";
import { newPunch } from "../lib/punchQueue";
import { buildTimesheet, lastPunch, nextPunchType } from "../lib/timesheet";

const HELP = "/ayuda#empleado";

/** Vista del empleado: fichar, ver su horario y su propio registro con el mismo cálculo que ve el dueño. */
export function EmployeeView() {
  const { token = "" } = useParams();
  const [data, setData] = useState<EmployeeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PunchInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [geoNote, setGeoNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [consent, setConsentState] = useState<GeoConsent>(() => getConsent());
  /** Marca esperando que el empleado elija si comparte la ubicación (primera vez), o "settings" para cambiarlo. */
  const [consentFor, setConsentFor] = useState<Punch | "settings" | null>(null);
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

  const workplaces = data.workplaces;
  const checksLocation = workplaces.length > 0;

  /** La hora de la marca es la del toque, aunque la ubicación tarde unos segundos. */
  function punch() {
    const p = newPunch(me.id, next);
    if (!checksLocation) return void save(p, false);
    if (consent === null) return setConsentFor(p);
    void save(p, consent === "granted");
  }

  /**
   * Guarda la marca (con ubicación si corresponde). Nunca se descarta por la ubicación: si está lejos,
   * sin GPS o sin permiso, se guarda igual y el dueño la ve para revisar.
   */
  async function save(p: Punch, withLocation: boolean) {
    setBusy(true);
    setGeoNote(null);
    const label = `${p.type === "IN" ? "Entrada" : "Salida"} marcada a las ${formatTime(p.at, tz)}.`;
    let input: PunchInput = p;
    if (withLocation) {
      setFeedback("Verificando tu ubicación…");
      const pos = await currentPosition();
      if ("error" in pos) {
        setGeoNote({ tone: "warn", text: `${POSITION_ERROR_TEXT[pos.error]} La marca se guardó igual, sin ubicación; el dueño la va a ver para revisar.` });
      } else {
        input = { ...p, location: pos };
        const check = checkGeofence(pos, workplaces)!;
        const place = workplaces[0]!.name;
        setGeoNote(
          check.status === "INSIDE"
            ? { tone: "ok", text: `Ubicación verificada: estás en ${place}.` }
            : check.status === "OUTSIDE"
              ? { tone: "warn", text: `Parece que no estás en ${place} (a ${formatDistance(check.distanceM)}). La marca se guardó igual y el dueño la va a revisar.` }
              : { tone: "warn", text: `El GPS está impreciso y no se pudo confirmar que estés en ${place}. La marca se guardó igual.` },
        );
      }
    } else if (checksLocation) {
      setGeoNote({ tone: "warn", text: "Marcaste sin compartir la ubicación. El dueño la va a ver para revisar." });
    }
    await punchQueue.enqueue(input);
    setPending(await punchQueue.pending());
    setFeedback(label);
    setBusy(false);
    void sync();
  }

  function decide(value: Exclude<GeoConsent, null>) {
    setConsent(value);
    setConsentState(value);
    const waiting = consentFor;
    setConsentFor(null);
    if (waiting && waiting !== "settings") void save(waiting, value === "granted");
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
        {geoNote && (
          <p className={`sync ${geoNote.tone} small`}>
            <MapPin size={16} aria-hidden="true" />
            {geoNote.text}
          </p>
        )}
        {checksLocation && (
          <p className="muted small">
            Al fichar se verifica que estés en <strong>{workplaces[0]!.name}</strong>
            {consent === "declined" ? " (desactivado: marcás sin ubicación)" : ""}.{" "}
            <button type="button" className="link-btn" onClick={() => setConsentFor("settings")}>
              {consent === null ? "¿Qué es esto?" : "Cambiar"}
            </button>
          </p>
        )}
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

      {consentFor && (
        <Modal title="Ubicación al fichar" onClose={() => setConsentFor(null)}>
          <div className="stack">
            <p>
              El comercio verifica que fiches desde <strong>{workplaces[0]?.name}</strong>.
            </p>
            <ul className="tip-list small">
              <li>Tu ubicación se lee <strong>solo en el momento de tocar el botón</strong>. No se sigue tu recorrido.</li>
              <li>No se guardan tus coordenadas: solo si estabas en el local y a qué distancia.</li>
              <li>
                Si no la compartís, igual podés fichar: la marca cuenta, pero el dueño la ve marcada para revisar.
              </li>
            </ul>
            <p className="muted small">Podés cambiar esta elección cuando quieras desde la pantalla de fichar.</p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => decide("declined")}>
                {consentFor === "settings" ? "No compartir" : "Fichar sin ubicación"}
              </button>
              <button type="button" className="btn primary" onClick={() => decide("granted")}>
                <MapPin size={18} aria-hidden="true" />
                {consentFor === "settings" ? "Compartir al fichar" : "Compartir y fichar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

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
