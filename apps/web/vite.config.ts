import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Turnos y Asistencia",
        short_name: "Turnos",
        description: "Horario, fichaje y registro de horas",
        lang: "es-AR",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1f6f5c",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        // La app abre sin señal; las marcas viajan por la cola de src/lib/punchQueue.ts, no por el SW.
        navigateFallback: "/index.html",
      },
    }),
  ],
});
