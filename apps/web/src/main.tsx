import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fuentes empaquetadas con la app (no Google Fonts) para que funcionen sin conexión.
import "@fontsource-variable/outfit";
import "@fontsource-variable/work-sans";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
