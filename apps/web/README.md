# apps/web

PWA con Vite + React. Dueño y empleado ven **el mismo registro** de horas, calculado con `@turnos/core`. El diseño sigue la guía de `ui-ux-pro-max` (minimalista y funcional, colores por tokens en `src/styles.css`, modo claro y oscuro, iconos Lucide, fuentes empaquetadas para que funcione sin señal).

## Cómo se navega

- **Inicio (`/`)**: elegís si sos empleado o dueño. En desarrollo hay accesos directos a los datos de ejemplo.
- **Empleado (`/e/:token`, enlace personal sin contraseña)**: botón grande para marcar entrada/salida (con cola offline y, si el comercio cargó su local, ubicación solo en ese instante y con consentimiento), **Mi calendario** con el horario de cada día (de corrido o cortado), lo trabajado y las horas extra, y **Mi mes** con el total.
- **Dueño (`/dueno/:token`)**, tres pestañas:
  - **Horarios**: calendario mensual. Desplegable **Ver horario de** (todo el equipo, cada uno con su color, o una persona). Tocar un día muestra el detalle y permite **Asignar horario** (de corrido o cortado) en uno o varios días a la vez. Lo asignado queda en borrador hasta **Publicar horarios**.
  - **Horas**: total del mes por empleado y el detalle de cada uno.
  - **Local**: lugar de trabajo y radio para verificar dónde se ficha. Las marcas fuera del local, sin ubicación o con GPS impreciso aparecen para revisar.
- **Ayuda (`/ayuda`)**: mini manual. El botón **Ayuda** está siempre arriba a la derecha y lleva a la parte que corresponde.

## Correr

```bash
npm run dev:web     # desde la raíz
npm run build:web
```

Sin `VITE_API_URL` (ver `.env.example`) corre en **modo demo**: datos de `src/demo.ts` en memoria (se reinician al recargar). Entradas: `/dueno`, `/e/ana`, `/e/bruno`.

Con la API: `VITE_API_URL=http://localhost:3000` y `npm run dev -w @turnos/api` (sin base, la API usa datos en memoria). El dueño entra por `/dueno/dueno` (provisorio).

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/lib/timesheet.ts` | `buildTimesheet`: registro de un empleado con `core` (pares, horas, asistencia, descansos). `checkSchedule`: avisos antes de publicar. |
| `src/lib/calendar.ts` | `buildCalendar`: por día y empleado, lo planificado contra lo marcado (horas y extra salen de `buildTimesheet`). |
| `src/lib/punchQueue.ts` | Cola offline. Una marca sale solo cuando el servidor confirma. El `id` es el `clientEventId`. |
| `src/lib/api.ts` | Cliente de `apps/api` (o de `demo.ts` en modo demo). |
| `src/components/MonthCalendar.tsx`, `DayDetail.tsx` | Calendario y detalle del día, compartidos por dueño y empleado. |
| `src/components/TimesheetView.tsx` | Registro del mes, compartido por las dos vistas. |
| `src/views/HelpView.tsx` | Manual. |

## Pendiente

- Autenticación del dueño (hoy, enlace con token).
- Corregir marcas y resolver anomalías desde el panel.
- Aviso por WhatsApp al publicar.
- Si la API responde 4xx a una marca, la cola la reintenta para siempre y bloquea las siguientes. Hay que mostrarla como "rechazada" sin borrarla.
- "Extra" hoy es lo que pasa el tope diario configurado. El detalle del día también muestra cuánto se trabajó de más respecto del turno; falta decidir con el contador cuál de las dos se paga.
