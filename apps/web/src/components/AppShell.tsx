import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { BookOpen, CalendarDays, CircleHelp, Clock, Home, Smartphone } from "lucide-react";
import { DEMO_MODE } from "../lib/api";

interface Props {
  /** A qué sección del manual lleva el botón de ayuda. Siempre en el mismo lugar (arriba a la derecha). */
  helpHref?: string;
  children: ReactNode;
}

/** Con datos de ejemplo se puede saltar entre dueño y empleados. En producción cada uno entra por su enlace. */
const SHOW_DEMO_NAV = DEMO_MODE || import.meta.env.DEV;

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
        {SHOW_DEMO_NAV && <DemoNav />}
      </header>
      <main className="page">{children}</main>
    </>
  );
}

function DemoNav() {
  const owner = DEMO_MODE ? "/dueno" : "/dueno/dueno";
  const items = [
    { to: "/", label: "Inicio", icon: Home, end: true },
    { to: owner, label: "Dueño", icon: CalendarDays },
    { to: "/e/ana", label: "Ana", icon: Smartphone },
    { to: "/e/bruno", label: "Bruno", icon: Smartphone },
    { to: "/ayuda", label: "Manual", icon: BookOpen },
  ];
  return (
    <nav className="demo-nav" aria-label="Ver el sistema como">
      <div className="demo-nav-inner">
        <span className="demo-nav-label">Ver como:</span>
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="demo-nav-link">
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
