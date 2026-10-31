import { Link, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { FirstVisitTip } from "../components/FirstVisitTip";
import { OwnerHours } from "./owner/OwnerHours";
import { OwnerSchedule } from "./owner/OwnerSchedule";
import { OwnerWorkplace } from "./owner/OwnerWorkplace";

const HELP = "/ayuda#dueno";

/**
 * Panel del dueño: Horarios (calendario del mes), Horas (registro del mes) y Local (dónde se ficha).
 * PROVISORIO: entra por enlace con token, como los empleados. La auth del dueño es una decisión abierta.
 */
export function OwnerView() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const vista = params.get("vista");
  const tab = vista === "horas" || vista === "local" ? vista : "horarios";
  const base = token ? `/dueno/${token}` : "/dueno";

  return (
    <AppShell helpHref={HELP}>
      <nav className="tabs" aria-label="Secciones del panel">
        <Link to={base} aria-current={tab === "horarios" ? "page" : undefined}>
          <CalendarDays size={18} aria-hidden="true" />
          Horarios
        </Link>
        <Link to={`${base}?vista=horas`} aria-current={tab === "horas" ? "page" : undefined}>
          <Clock size={18} aria-hidden="true" />
          Horas
        </Link>
        <Link to={`${base}?vista=local`} aria-current={tab === "local" ? "page" : undefined}>
          <MapPin size={18} aria-hidden="true" />
          Local
        </Link>
      </nav>

      <FirstVisitTip id="dueno" title="¿Primera vez? Así se usa el panel" helpHref={HELP}>
        <ol className="tip-list">
          <li>
            El calendario muestra el horario de cada empleado con su color. Con <strong>Ver horario de</strong> elegís
            ver a uno solo.
          </li>
          <li>
            Tocá un día y <strong>Asignar horario</strong>: de corrido o cortado. Queda en borrador hasta que tocás{" "}
            <strong>Publicar horarios</strong>.
          </li>
          <li>A medida que marcan, cada día muestra lo trabajado y las horas extra.</li>
        </ol>
      </FirstVisitTip>

      {tab === "horarios" && <OwnerSchedule token={token} />}
      {tab === "horas" && <OwnerHours token={token} base={base} />}
      {tab === "local" && <OwnerWorkplace token={token} />}
    </AppShell>
  );
}
