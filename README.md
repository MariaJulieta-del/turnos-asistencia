# Turnos y Asistencia

Sistema de horarios y asistencia para comercios: el dueño arma la grilla mensual, cada empleado ve su horario en el celular y ficha desde ahí, y al fin de mes el dueño tiene las horas calculadas. Reemplaza el mensaje larguísimo de WhatsApp y la hoja de papel.

> Estado: **esqueleto de proyecto**. La lógica de dominio está hecha y testeada; la base de datos está diseñada pero no validada; la app web y la API todavía no existen.

## Qué hay hoy

| Paquete | Estado | Qué hace |
|---|---|---|
| `packages/core` | Hecho, 20 tests pasando | Empareja marcas entrada/salida, detecta anomalías, calcula horas (normales, extra, nocturnas, feriado), controla descansos y compara contra el horario planificado (puntual, tarde, ausente). Sin base de datos ni red. |
| `packages/db` | Esquema escrito, **no validado** | Esquema Prisma/PostgreSQL multi-comercio. |
| `apps/web` | Esqueleto, modo demo | PWA (Vite + React): fichaje con cola offline y el mismo registro de horas para dueño y empleado. |
| `apps/api` | Esqueleto, modo demo en memoria | API Fastify fina: autentica, valida, guarda marcas de forma idempotente y devuelve los datos del mes. |
| `packages/contract` | Hecho | Tipos compartidos entre API y web. |

## Cómo correrlo

```bash
npm install
npm test          # tests del núcleo
npm run typecheck
cp .env.example .env
npm run db:validate   # necesita bajar los motores de Prisma (requiere internet)
```

## Alcance del MVP (6 semanas, 2 personas)

1. Modelo de datos y usuarios.
2. Grilla mensual con plantillas rotativas, francos y feriados.
3. Publicación y aviso por WhatsApp con enlace personal.
4. Fichaje desde el celular (ubicación opcional, cola offline).
5. Cambios de turno con aprobación del dueño, reportes y cálculo de horas.
6. Piloto con un comercio real y exportación para el contador.

Se calculan **horas**, no sueldos: la liquidación sigue en manos del contador.

## Lo que hay que validar antes de vender

- Las reglas de horas son supuestos configurables, no ley. Ver `docs/REGLAS_HORAS.md`.
- Geolocalización de empleados: consentimiento y consulta con un laboralista (Ley 25.326).
- Competencia y precios de sistemas similares en Argentina: sin investigar todavía.
- Disposición a pagar: sin validar. El piloto con el comercio conocido es el primer dato.
