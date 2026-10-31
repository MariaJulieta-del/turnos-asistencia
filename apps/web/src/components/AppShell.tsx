import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CircleHelp, Clock } from "lucide-react";

interface Props {
  /** A qué sección del manual lleva el botón de ayuda. Siempre en el mismo lugar (arriba a la derecha). */
  helpHref?: string;
  children: ReactNode;
}

export function AppShell({ helpHref = "/ayuda", children }: Props) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Clock size={18} strokeWidth={2.25} />
            </span>
            Turnos
          </Link>
          <Link to={helpHref} className="btn ghost">
            <CircleHelp size={20} aria-hidden="true" />
            Ayuda
          </Link>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
