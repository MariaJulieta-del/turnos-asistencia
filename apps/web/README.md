# apps/web

PWA con Vite + React. Dos vistas que muestran **el mismo registro** de horas, calculado con `@turnos/core`:

- **Empleado** (`/e/:token`, enlace personal sin contraseña): botón de fichar con cola offline, sus horas por día, su asistencia contra el horario y sus marcas a revisar.
- **Dueño** (`/dueno`): resumen de horas del equipo y, al tocar un empleado, el mismo detalle que ve ese empleado.

## Correr

```bash
npm run dev:web     # desde la raíz
npm run build:web
```

Sin `VITE_API_URL` (ver `.env.example`) corre en **modo demo** con datos de `src/demo.ts`: `/dueno`, `/e/ana`, `/e/bruno`. Las marcas quedan en la cola local porque no hay API.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/lib/timesheet.ts` | `buildTimesheet`: arma el registro de un empleado con `core` (pares, horas, asistencia, descansos). Única fuente de números para las dos vistas. |
| `src/lib/punchQueue.ts` | Cola offline. Una marca sale solo cuando el servidor confirma. El `id` es el `clientEventId`. |
| `src/lib/localQueue.ts` | La cola guardada en IndexedDB. |
| `src/lib/api.ts` | Cliente de `apps/api`. Las rutas (`/me/snapshot`, `/owner/snapshot`, `POST /punches`) son una propuesta de contrato. |
| `src/components/TimesheetView.tsx` | Registro compartido por las dos vistas. |

Con la API: `VITE_API_URL=http://localhost:3000` y `npm run dev -w @turnos/api` (sin base, la API usa datos en memoria). El dueño entra por `/dueno/<token>` (provisorio).

## Pendiente

- Autenticación del dueño (hoy, enlace con token).
- Si la API responde 4xx a una marca, la cola la reintenta para siempre y bloquea las siguientes. Hay que mostrarla como "rechazada" sin borrarla.
- Grilla mensual, aprobaciones de cambio de turno y resolución de anomalías.
- Ubicación al fichar (solo con consentimiento, ver `docs/ARQUITECTURA.md`).
- Exportación CSV para el contador.
