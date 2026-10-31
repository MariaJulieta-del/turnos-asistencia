# Turnos y Asistencia

Monorepo TypeScript (npm workspaces). Español rioplatense en docs y mensajes al usuario; código y nombres técnicos en inglés.

## Comandos

- `npm test` — Vitest sobre `packages/*/test/**/*.test.ts` y `apps/*/test/**/*.test.ts`
- `npm run typecheck` — `tsc --noEmit` de la raíz y de `apps/web`
- `npm run dev:web` / `npm run build:web` — PWA (Vite + React). Sin `VITE_API_URL` corre en modo demo.
- `npm run db:validate` — valida el esquema Prisma (requiere descargar motores)

## Reglas del proyecto

- La lógica de negocio (horas, descansos, tardanzas) va en `packages/core`, pura, sin I/O. Todo cambio ahí lleva test.
- Los instantes son epoch ms UTC; la zona horaria se aplica solo al clasificar (`tzOffsetMinutes`).
- Las reglas laborales (franja nocturna, tope diario, descanso) son **supuestos configurables**. No presentarlas como ley; ver `docs/REGLAS_HORAS.md`.
- Nunca inventar horas: lo ambiguo se reporta como anomalía.
- Geolocalización: solo al fichar, con consentimiento, nunca seguimiento continuo.
- Se calculan horas, no sueldos.

## Estado

`core` hecho y testeado. `db` con esquema validado (sin migraciones todavía). `apps/web` y `apps/api` con esqueleto: fichaje con cola offline y registro compartido. Los dos corren en modo demo sin base (`apps/api` sin `DATABASE_URL`, `apps/web` sin `VITE_API_URL`).

- `npm run dev -w @turnos/api` / `npm run typecheck -w @turnos/api` (el typecheck de la API todavía no está en el script de la raíz).
- La API no calcula horas: devuelve datos crudos y el cliente usa `core`. Tipos compartidos en `packages/contract`.
- Horarios: calendario mensual en el panel del dueño (`/owner/schedule`). Un horario cortado son dos turnos el mismo día; `findRestViolations` con `tzOffsetMinutes` no cuenta esa pausa como falta de descanso.
- UI: guía `ui-ux-pro-max`. Colores solo por tokens de `apps/web/src/styles.css`; nada de emojis como iconos (Lucide).

- La web no calcula por su cuenta: todo número pasa por `buildTimesheet` (`apps/web/src/lib/timesheet.ts`) → `core`.
- Los archivos de config de la raíz tienen atributo de solo lectura; pedir permiso antes de tocarlos.
