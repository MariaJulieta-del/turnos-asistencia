import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { BookOpen, CalendarDays, Smartphone } from "lucide-react";
import { AppShell } from "./components/AppShell";
import { DEMO_MODE } from "./lib/api";
import { EmployeeView } from "./views/EmployeeView";
import { HelpView } from "./views/HelpView";
import { OwnerView } from "./views/OwnerView";

function Home() {
  const ownerHref = DEMO_MODE ? "/dueno" : "/dueno/dueno";
  return (
    <AppShell>
      <header className="page-head">
        <h1>Turnos y Asistencia</h1>
        <p className="muted">Horarios, fichaje y horas trabajadas, a la vista del dueño y de cada empleado.</p>
      </header>

      {import.meta.env.DEV && (
        <p className="callout info small">
          {DEMO_MODE
            ? "Modo demo: datos de ejemplo que viven en el navegador. Si recargás, vuelven a como estaban."
            : "Conectado a la API local con datos de ejemplo."}
        </p>
      )}

      <div className="role-cards">
        <section className="card" aria-labelledby="role-emp">
          <span className="role-icon" aria-hidden="true">
            <Smartphone size={22} />
          </span>
          <h2 id="role-emp">Soy empleado/a</h2>
          <p className="muted">
            Entrás con el enlace personal que te manda el dueño. Ahí marcás entrada y salida, ves tus turnos y tus horas.
          </p>
          {import.meta.env.DEV && (
            <div className="actions">
              <Link to="/e/ana" className="btn">
                Entrar como Ana
              </Link>
              <Link to="/e/bruno" className="btn">
                Entrar como Bruno
              </Link>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="role-owner">
          <span className="role-icon" aria-hidden="true">
            <CalendarDays size={22} />
          </span>
          <h2 id="role-owner">Soy el dueño</h2>
          <p className="muted">Armás los horarios de la semana, los publicás y ves las horas de todo el equipo.</p>
          {import.meta.env.DEV && (
            <div className="actions">
              <Link to={ownerHref} className="btn primary">
                Abrir el panel
              </Link>
            </div>
          )}
        </section>
      </div>

      <Link to="/ayuda" className="card help-teaser">
        <BookOpen size={22} aria-hidden="true" />
        <span>
          <strong>¿Primera vez?</strong>
          <span className="muted"> Leé cómo se usa (2 minutos).</span>
        </span>
      </Link>
    </AppShell>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ayuda" element={<HelpView />} />
        <Route path="/dueno/:token?" element={<OwnerView />} />
        {/* Enlace personal del empleado (sin contraseña). */}
        <Route path="/e/:token" element={<EmployeeView />} />
      </Routes>
    </BrowserRouter>
  );
}
