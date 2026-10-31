import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { DEMO_MODE } from "./lib/api";
import { EmployeeView } from "./views/EmployeeView";
import { OwnerView } from "./views/OwnerView";

function Home() {
  return (
    <div className="stack">
      <h2>Turnos y Asistencia</h2>
      <p className="muted">Los empleados entran por su enlace personal. El dueño, por su panel.</p>
      {import.meta.env.DEV && (
        <section className="card">
          <h3>{DEMO_MODE ? "Modo demo" : "Datos de ejemplo de la API"}</h3>
          <ul className="plain">
            <li>
              <Link to="/dueno/dueno">Panel del dueño</Link>
            </li>
            <li>
              <Link to="/e/ana">Enlace de Ana</Link>
            </li>
            <li>
              <Link to="/e/bruno">Enlace de Bruno</Link>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <main className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dueno/:token?" element={<OwnerView />} />
          {/* Enlace personal del empleado (sin contraseña). */}
          <Route path="/e/:token" element={<EmployeeView />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
