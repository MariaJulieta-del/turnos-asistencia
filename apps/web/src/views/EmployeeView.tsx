import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Punch } from "@turnos/core";
import { TimesheetView } from "../components/TimesheetView";
import { DEMO_MODE, fetchEmployeeSnapshot, sendPunch, type EmployeeSnapshot } from "../lib/api";
import { formatTime } from "../lib/format";
import { punchQueue } from "../lib/localQueue";
import { newPunch } from "../lib/punchQueue";
import { buildTimesheet, nextPunchType } from "../lib/timesheet";
import { DEMO_SNAPSHOT, DEMO_TOKENS } from "../demo";

type Loaded = EmployeeSnapshot;

async function load(token: string): Promise<Loaded> {
  if (!DEMO_MODE) return fetchEmployeeSnapshot(token);
  const me = DEMO_SNAPSHOT.employees.find((e) => e.id === DEMO_TOKENS[token]);
  if (!me) throw new Error("Enlace no válido");
  return { ...DEMO_SNAPSHOT, me };
}

/** Vista del empleado: fichar, y ver su propio registro con el mismo cálculo que ve el dueño. */
export function EmployeeView() {
  const { token = "" } = useParams();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Punch[]>([]);

  const hasData = useRef(false);

  /**
   * Envía la cola y recarga. Primero los datos del servidor y después la cola: así una marca recién
   * enviada nunca desaparece de la pantalla entre que sale de la cola y llega en el snapshot.
   */
  const sync = useCallback(async () => {
    await punchQueue.flush((p) => sendPunch(token, p));
    try {
      setData(await load(token));
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

  if (error) return <p className="card warn">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;

  const { me, business, planned } = data;
  const next = nextPunchType(punches, me.id);
  const sheet = buildTimesheet(me.id, punches, planned, business);
  const myPending = pending.filter((p) => p.employeeId === me.id);

  async function punch() {
    await punchQueue.enqueue(newPunch(me.id, next));
    setPending(await punchQueue.pending());
    void sync();
  }

  return (
    <div className="stack">
      <header>
        <p className="muted">Hola,</p>
        <h2>{me.name}</h2>
      </header>

      <section className="card center">
        <button className={`punch ${next === "IN" ? "in" : "out"}`} onClick={punch}>
          {next === "IN" ? "Fichar entrada" : "Fichar salida"}
        </button>
        {myPending.length > 0 && (
          <p className="muted small">
            {myPending.length} marca(s) guardada(s) en el celular, se envían cuando haya señal:{" "}
            {myPending.map((p) => `${p.type === "IN" ? "entrada" : "salida"} ${formatTime(p.at, business.tzOffsetMinutes)}`).join(", ")}
          </p>
        )}
      </section>

      <h3>Mi registro</h3>
      <TimesheetView sheet={sheet} planned={planned} tzOffsetMinutes={business.tzOffsetMinutes} />
    </div>
  );
}
