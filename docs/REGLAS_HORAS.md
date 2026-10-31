# Reglas de cálculo de horas

**Aviso:** todo lo de este documento son **supuestos configurables**, no asesoramiento legal. Hay que validarlos contra el convenio colectivo de comercio vigente y la Ley de Contrato de Trabajo con un laboralista o el contador del comercio antes de usarlos para liquidar.

## Qué hace el cálculo hoy

Cada **minuto** trabajado se asigna a exactamente una categoría, con esta precedencia:

1. **Feriado**: el minuto cae en una fecha local marcada como feriado.
2. **Extra**: el empleado ya acumuló el tope diario (`dailyNormalMin`, default 480).
3. **Nocturno**: el minuto está en la franja nocturna (default 21:00–06:00).
4. **Normal**: el resto.

Como cada minuto cae en una sola categoría, `total = normal + extra + nocturno + feriado` siempre.

El tope diario se acumula por la **fecha local en que empieza el turno**, de modo que un turno nocturno que cruza medianoche cuenta como un solo día.

## Defaults y su estado

| Parámetro | Default | Estado |
|---|---|---|
| Zona horaria | −180 min (Argentina) | Seguro: sin horario de verano |
| Franja nocturna | 21:00–06:00 | **Supuesto, verificar** |
| Tope diario | 480 min (8 h) | **Supuesto, verificar** |
| Descanso mínimo entre jornadas | 720 min (12 h) | **Supuesto, verificar** |
| Tolerancia de tardanza | 5 min | Decisión de producto, configurable |

## Decisiones abiertas (preguntar al contador / laboralista)

- ¿Una hora nocturna que además es extra se paga como extra, como nocturna, o con recargos acumulados? Hoy cuenta solo como **extra**.
- ¿Una hora extra en feriado? Hoy cuenta solo como **feriado**.
- ¿El tope es diario, semanal, o ambos? Hoy solo hay tope diario; falta el semanal y el mensual.
- ¿La hora nocturna tiene duración reducida según el convenio? Hoy no se aplica reducción.
- Francos trabajados y sábados a la tarde: hoy no se tratan distinto.
- Redondeo: hoy se truncan los minutos incompletos al inicio y al fin.
- Tardanzas: ¿descuentan? ¿desde qué minuto? Hoy solo se reportan.

## Anomalías de marcas

| Tipo | Significado | Qué hace el sistema |
|---|---|---|
| `DOUBLE_IN` | Dos entradas seguidas | Descarta la anterior, la marca para revisión |
| `ORPHAN_OUT` | Salida sin entrada | La ignora y la marca |
| `OPEN_IN` | Entrada sin salida | No cuenta horas y la marca |
| `LONG_INTERVAL` | Intervalo > 16 h | Lo calcula igual y lo marca |
