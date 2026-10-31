# Arquitectura

## Principios

1. **Núcleo puro.** Todo cálculo (horas, descansos, tardanzas) vive en `packages/core` sin base de datos ni red. Se testea con datos en memoria y es la parte que más cuesta copiar.
2. **Offline primero para fichar.** El celular guarda la marca localmente con un `clientEventId` y la reenvía cuando hay señal. El servidor deduplica por ese id, así un reintento nunca duplica una marca.
3. **Nunca inventar horas.** Una marca ambigua (doble entrada, salida sin entrada, entrada abierta) queda como anomalía y la resuelve el dueño; el sistema no adivina.
4. **Instantes en UTC, zona en el comercio.** Argentina no tiene horario de verano (offset fijo −180), pero el modelo guarda `timezone` por comercio.
5. **Ubicación mínima.** Solo se lee en el instante de fichar, con consentimiento, y se compara con una geovalla en el servidor (`checkGeofence` en `core`). No se guardan coordenadas del empleado: solo el resultado (adentro, afuera, impreciso, sin ubicación), la distancia y el error del GPS. Nunca hay seguimiento continuo y nunca se rechaza una marca por la ubicación: lo dudoso queda para que el dueño revise.

## Capas

```
apps/web (PWA)  ──►  apps/api (Fastify)  ──►  packages/db (Prisma / PostgreSQL)
      │                    │
      └────────────────────┴──►  packages/core (lógica pura)
```

- **apps/web** (Vite + React, PWA): dos vistas. Dueño: grilla mensual, aprobaciones, anomalías, reporte de horas. Empleado: mi horario, botón fichar, pedir cambio de turno. Empleados entran por enlace personal (sin contraseña).
- **Registro compartido**: el empleado ve sus propias marcas, horas y anomalías con el mismo cálculo (`buildTimesheet`) y el mismo componente que el dueño. Ninguno depende de lo que diga el otro.
- **API** (`apps/api`, Fastify): fina. Autentica, valida y persiste; devuelve datos crudos por mes y el cliente calcula con `core`. Los tipos compartidos viven en `packages/contract`. Detalle de rutas en `apps/api/README.md`.

## Decisión: Vite + React y Fastify (2026-10-30)

Elegido sobre Next.js porque fichar sin conexión es central (service worker y cola en IndexedDB son más simples en una app de una sola página) y porque una API separada mantiene fina la capa de servidor. Costo: dos deploys y CORS/auth entre ellos. Next.js no aporta SSR útil a una app con login.
- **Aviso por WhatsApp**: primera versión con enlace `wa.me` prearmado (costo cero, el dueño toca enviar). La API oficial de WhatsApp Business cobra por mensaje y se evalúa después.

## Decisiones abiertas

- Autenticación del dueño (email + contraseña vs. enlace mágico).
- Hosting y costo mensual por comercio.
- Cómo exportar para el contador (CSV primero).
