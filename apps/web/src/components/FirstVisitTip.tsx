import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lightbulb } from "lucide-react";

interface Props {
  id: string;
  title: string;
  helpHref: string;
  children: ReactNode;
}

const key = (id: string) => `turnos:tip:${id}`;

function wasDismissed(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === "1";
  } catch {
    return false;
  }
}

/** Consejo para la primera visita. Se puede cerrar y no vuelve a aparecer en ese celular. */
export function FirstVisitTip({ id, title, helpHref, children }: Props) {
  const [hidden, setHidden] = useState(() => wasDismissed(id));
  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(key(id), "1");
    } catch {
      // Sin almacenamiento (modo privado): se oculta solo por esta visita.
    }
    setHidden(true);
  }

  return (
    <section className="callout info" aria-labelledby={`tip-${id}`}>
      <div className="callout-head">
        <Lightbulb size={20} aria-hidden="true" />
        <h2 id={`tip-${id}`} className="callout-title">
          {title}
        </h2>
      </div>
      <div className="small">{children}</div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={dismiss}>
          Entendido
        </button>
        <Link to={helpHref} className="btn ghost">
          Ver el manual completo
        </Link>
      </div>
    </section>
  );
}
