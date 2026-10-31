# Turnos y Asistencia

Monorepo TypeScript (npm workspaces). Español rioplatense en docs y mensajes al usuario; código y nombres técnicos en inglés.

## Comandos

- `npm test` — Vitest sobre `packages/*/test/**/*.test.ts`
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:validate` — valida el esquema Prisma (requiere descargar motores)

## Reglas del proyecto

- La lógica de negocio (horas, descansos, tardanzas) va en `packages/core`, pura, sin I/O. Todo cambio ahí lleva test.
- Los instantes son epoch ms UTC; la zona horaria se aplica solo al clasificar (`tzOffsetMinutes`).
- Las reglas laborales (franja nocturna, tope diario, descanso) son **supuestos configurables**. No presentarlas como ley; ver `docs/REGLAS_HORAS.md`.
- Nunca inventar horas: lo ambiguo se reporta como anomalía.
- Geolocalización: solo al fichar, con consentimiento, nunca seguimiento continuo.
- Se calculan horas, no sueldos.

## Estado

`core` hecho y testeado. `db` con esquema sin validar. `apps/web` y la API pendientes.
