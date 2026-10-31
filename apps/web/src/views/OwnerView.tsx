import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { TimesheetView } from "../components/TimesheetView";
import { DEMO_MODE, fetchOwnerSnapshot, type Snapshot } from "../lib/api";
import { formatMinutes } from "../lib/format";
import { buildTimesheet } from "../lib/timesheet";
import { DEMO_SNAPSHOT } from "../demo";

/**
 * Vista del dueño: resumen por empleado y detalle con el mismo registro que ve cada empleado.
 * PROVISORIO: entra por enlace con token, como los empleados. La auth del dueño es una decisión abierta.
 */
export function OwnerView() {
  const { token = "" } = useParams();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (DEMO_MODE ? Promise.resolve(DEMO_SNAPSHOT) : fetchOwnerSnapshot(token)).then(setData, (e: Error) =>
      setError(e.message),
    );
  }, [token]);

  const sheets = useMemo(
    () => data?.employees.map((e) => ({ employee: e, sheet: buildTimesheet(e.id, data.punches, data.planned, data.business) })) ?? [],
    [data],
  );

  if (error) return <p className="card warn">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;

  const current = sheets.find((s) => s.employee.id === selected);

  return (
    <div className="stack">
      <h2>Horas del equipo</h2>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Empleado</th>
              <th className="num">Total</th>
              <th className="num">Extra</th>
              <th className="num">Noct.</th>
              <th className="num">Revisar</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map(({ employee, sheet }) => (
              <tr
                key={employee.id}
                className={employee.id === selected ? "selected clickable" : "clickable"}
                onClick={() => setSelected(employee.id === selected ? null : employee.id)}
              >
                <td>{employee.name}</td>
                <td className="num">{formatMinutes(sheet.hours.total.total)}</td>
                <td className="num">{formatMinutes(sheet.hours.total.extra)}</td>
                <td className="num">{formatMinutes(sheet.hours.total.night)}</td>
                <td className="num">{sheet.anomalies.length || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {current && (
        <>
          <h3>{current.employee.name}</h3>
          <TimesheetView sheet={current.sheet} planned={data.planned} tzOffsetMinutes={data.business.tzOffsetMinutes} />
        </>
      )}
    </div>
  );
}
