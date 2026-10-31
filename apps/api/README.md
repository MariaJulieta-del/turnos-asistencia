# apps/api

API Fastify **fina**: autentica, valida y guarda. No calcula horas: devuelve los datos crudos del mes y el cliente los calcula con `@turnos/core`. Así el dueño y el empleado ven el mismo resultado a partir de los mismos datos. Los tipos que viajan están en `packages/contract`.

## Correr

```bash
npm run dev -w @turnos/api
```

- Con `DATABASE_URL` (en `.env` de la raíz) usa Postgres vía Prisma.
- Sin `DATABASE_URL` arranca en **modo demo en memoria** con los tokens `dueno`, `ana` y `bruno`. No guarda nada al reiniciar.
- `PORT` (default 3000), `WEB_ORIGIN` (default `http://localhost:5173`, se aceptan varios separados por coma).

Para usarla desde la web: `VITE_API_URL=http://localhost:3000` en `apps/web/.env`.

## Rutas

Todas con `Authorization: Bearer <token del enlace personal>`. El token se guarda hasheado (`User.accessTokenHash`).

| Ruta | Quién | Qué hace |
|---|---|---|
| `GET /health` | cualquiera | Chequeo de vida. |
| `GET /me/snapshot?month=YYYY-MM` | cualquier usuario | Reglas del comercio, sus marcas y sus turnos publicados del mes (default: mes actual del comercio). |
| `GET /owner/snapshot?month=YYYY-MM` | `OWNER`, `MANAGER` | Lo mismo para todo el equipo. |
| `GET /owner/schedule?month=YYYY-MM` | `OWNER`, `MANAGER` | Calendario del mes: turnos (borradores y publicados), marcas reales y plantillas de toda la grilla visible (semanas completas de lunes a domingo). |
| `POST /owner/shifts` | `OWNER`, `MANAGER` | Asigna el mismo horario en uno o varios días, en borrador: `{ employeeId, dates: [...], segments: [{ startMin, endMin }] }`. Uno o dos tramos (cortado); hasta 62 días. Si `endMin <= startMin`, termina al día siguiente. Todo o nada. |
| `GET /owner/workplace` · `PUT /owner/workplace` | `OWNER`, `MANAGER` | Lugar de trabajo con geovalla: `{ name, lat, lng, radiusM }` (30 a 2000 m). |
| `DELETE /owner/shifts/:id` | `OWNER`, `MANAGER` | Borrador: se borra. Publicado: se cancela (queda registrado). |
| `POST /owner/schedule/publish` | `OWNER`, `MANAGER` | Publica los borradores entre `from` y `to` (fechas locales, inclusive). |
| `POST /punches` | cualquier usuario | Guarda una marca. Si el comercio tiene local, acepta `location: { lat, lng, accuracyM }`: el servidor calcula si estaba adentro (`geo`: INSIDE, OUTSIDE, UNCERTAIN o NONE) y **descarta las coordenadas**. Nunca rechaza una marca por la ubicación. Idempotente por `id` (clientEventId): `201 created`, `200 duplicate`. Solo para uno mismo (`403`); un id ya usado por otra persona es `409` y no pisa nada. Campos desconocidos: `400`. |

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/app.ts` | `buildApp({ store })`: rutas y validación. Se testea con `app.inject`, sin red ni base. |
| `src/store.ts` | Interfaz de acceso a datos. |
| `src/prismaStore.ts` / `src/memoryStore.ts` | Implementaciones: Postgres y memoria (tests y demo). |
| `src/period.ts` | Mes local -> rango de instantes; offset de la zona IANA del comercio. |
| `src/auth.ts` | Token de enlace -> usuario y rol. |

## Pendiente

- **Auth del dueño**: hoy entra por enlace con token como los empleados. Es provisorio (decisión abierta).
- Rutas del dueño: corrección de marcas (`source: MANUAL`, `editedById`), resolución de anomalías, aprobación de cambios de turno, edición de plantillas.
- Aviso por WhatsApp al publicar (enlace `wa.me` por empleado).
- Exportación CSV.
- Bordes del mes: el snapshot corta exacto en las 00:00 locales, así que una salida pasada la medianoche del último día queda en el mes siguiente y se ve como anomalía en los dos meses.
