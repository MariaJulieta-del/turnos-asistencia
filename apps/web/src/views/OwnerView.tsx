import { Link, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { FirstVisitTip } from "../components/FirstVisitTip";
import { OwnerSchedule } from "./owner/OwnerSchedule";
import { OwnerTeam } from "./owner/OwnerTeam";
import { OwnerWorkplace } from "./owner/OwnerWorkplace";

const HELP = "/ayuda#dueno";

/**
 * Panel del dueño: Horarios (calendario del mes), Equipo (recuento por empleado) y Local (dónde se ficha).
 * PROVISORIO: entra por enlace con token, como los empleados. La auth del dueño es una decisión abierta.
 */
export function OwnerView() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const vista = params.get("vista");
  // "horas" era el nombre anterior de Equipo: se acepta para no romper enlaces guardados.
  const tab = vista === "equipo" || vista === "horas" ? "equipo" : vista === "local" ? "local" : "horarios";
  const base = token ? `/dueno/${token}` : "/dueno";

  return (
    <AppShell helpHref={HELP}>
      <nav className="tabs" aria-label="Secciones del panel">
        <Link to={base} aria-current={tab === "horarios" ? "page" : undefined}>
          <CalendarDays size={18} aria-hidden="true" />
          Horarios
        </Link>
        <Link to={`${base}?vista=equipo`} aria-current={tab === "equipo" ? "page" : undefined}>
          <Users size={18} aria-hidden="true" />
          Equipo
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
          <li>
            En <strong>Equipo</strong> tenés una card por empleado con sus horas, horas extra, asistencia y próximos
            horarios del mes.
          </li>
        </ol>
      </FirstVisitTip>

      {tab === "horarios" && <OwnerSchedule token={token} />}
      {tab === "equipo" && <OwnerTeam token={token} base={base} />}
      {tab === "local" && <OwnerWorkplace token={token} />}
    </AppShell>
  );
}
