import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "../components/AppShell";

/** Mini manual. Cada sección tiene un ancla para que el botón "Ayuda" lleve directo a lo que importa. */
export function HelpView() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <AppShell>
      <header className="page-head">
        <h1>Cómo se usa</h1>
        <p className="muted">Dos minutos de lectura. Elegí tu parte:</p>
      </header>

      <nav className="actions" aria-label="Secciones del manual">
        <a className="chip jump" href="#empleado">
          Empleados
        </a>
        <a className="chip jump" href="#dueno">
          Dueño
        </a>
        <a className="chip jump" href="#glosario">
          Qué significa cada cosa
        </a>
        <a className="chip jump" href="#instalar">
          Instalar en el celular
        </a>
      </nav>

      <section id="empleado" className="card help-section" aria-labelledby="h-empleado">
        <h2 id="h-empleado">Para empleados</h2>
        <ol className="steps">
          <li>
            <div>
              <h3>Entrá con tu enlace</h3>
              <p className="muted">
                El dueño te manda por WhatsApp un enlace personal. No hace falta usuario ni contraseña. No lo compartas:
                es solo tuyo.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Marcá entrada y salida</h3>
              <p className="muted">
                Al llegar tocá <strong>Marcar entrada</strong> (botón verde). Al irte, <strong>Marcar salida</strong>{" "}
                (botón gris). El botón cambia solo según lo que te toque.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Ubicación al fichar</h3>
              <p className="muted">
                Si el comercio cargó su local, la primera vez te pregunta si compartís la ubicación. Se lee{" "}
                <strong>solo en el momento de tocar el botón</strong> y no se guardan tus coordenadas: solo si estabas
                en el local. Si no la compartís o el GPS falla, la marca cuenta igual y el dueño la ve para revisar.
                Podés cambiar tu elección con <strong>Cambiar</strong>, debajo del botón.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>¿Sin señal? No pasa nada</h3>
              <p className="muted">
                La marca queda guardada en el celular con la hora en que tocaste y se envía sola cuando vuelve la
                conexión. Vas a ver un aviso amarillo mientras esté pendiente.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Mirá tu calendario</h3>
              <p className="muted">
                En <strong>Mi calendario</strong> cada día muestra tu horario (de corrido o cortado). A medida que
                marcás aparece lo trabajado (✓) y, si te quedaste de más, las horas extra en amarillo. Tocá un día para
                ver el detalle. En <strong>Mi mes</strong> está el total. Son los mismos números que ve el dueño.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Si aparece algo «Para revisar»</h3>
              <p className="muted">
                Por ejemplo, si te olvidaste de marcar la salida. Ese día no suma horas hasta que se corrija: avisale
                al dueño a qué hora saliste.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section id="dueno" className="card help-section" aria-labelledby="h-dueno">
        <h2 id="h-dueno">Para el dueño</h2>
        <p className="muted">
          El panel tiene dos pestañas arriba: <strong>Horarios</strong> y <strong>Horas</strong>.
        </p>
        <ol className="steps">
          <li>
            <div>
              <h3>Mirá el calendario</h3>
              <p className="muted">
                Al entrar ves el mes. Cada empleado tiene su color y sus iniciales. Con <strong>Ver horario de</strong>{" "}
                (o tocando un nombre) ves a una sola persona; con <strong>Todo el equipo</strong>, a todos. Las flechas
                cambian de mes.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Asigná horarios</h3>
              <p className="muted">
                Tocá un día y después <strong>Asignar horario</strong>. Elegí el empleado y{" "}
                <strong>todos los días</strong> que lleven ese horario (tocándolos, o con los atajos «Lun a vie de esa
                semana» o «Lun a vie de todo el mes»). Después, si es{" "}
                <strong>de corrido</strong> (un tramo) o <strong>cortado</strong> (dos tramos, por ejemplo 9 a 13 y 17
                a 21). Los horarios frecuentes (Mañana, Tarde, Cierre) se cargan con un toque. Si la salida es más
                temprano que la entrada, termina al día siguiente.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Revisá los avisos</h3>
              <p className="muted">
                Si dos horarios de la misma persona se superponen o si descansa poco entre una jornada y la siguiente,
                aparece un aviso amarillo. La pausa de un horario cortado no cuenta como falta de descanso. No bloquea:
                decidís vos.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Publicá</h3>
              <p className="muted">
                Lo que cargás queda en <strong>borrador</strong> (con borde punteado) y los empleados no lo ven. Cuando
                esté listo, tocá <strong>Publicar horarios</strong>.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Seguí lo trabajado día a día</h3>
              <p className="muted">
                A medida que los empleados marcan, cada día del calendario muestra lo trabajado (✓) y las horas extra
                (en amarillo). Tocá el día para ver el detalle: horario asignado, lo que marcó cada uno, si llegó tarde
                y si trabajó más que el turno.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Cambiá o cancelá un horario</h3>
              <p className="muted">
                En el detalle del día, tocá el horario. Un borrador se quita sin más. Uno publicado se cancela y
                desaparece del horario del empleado: avisale del cambio.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Cargá el local en Local</h3>
              <p className="muted">
                Parado en el comercio, tocá <strong>Usar mi ubicación actual</strong>, elegí el radio (100 m alcanza
                casi siempre) y guardá. Desde ahí, cada marca muestra si se hizo en el local. Las que se hicieron
                lejos, sin ubicación o con GPS impreciso aparecen con el ícono de ubicación para revisar; nunca se
                rechazan.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h3>Mirá el resumen en Horas</h3>
              <p className="muted">
                Está el total del mes por empleado y cuántas cosas hay para revisar. Tocá un nombre para ver el detalle
                día por día, igual al que ve esa persona.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section id="glosario" className="card help-section" aria-labelledby="h-glosario">
        <h2 id="h-glosario">Qué significa cada cosa</h2>
        <dl className="glossary">
          <div>
            <dt>Horas normales</dt>
            <dd>Las trabajadas hasta el tope diario configurado (hoy, 8 h por día).</dd>
          </div>
          <div>
            <dt>Horas extra</dt>
            <dd>Las que pasan ese tope en un mismo día.</dd>
          </div>
          <div>
            <dt>Horas nocturnas</dt>
            <dd>Las que caen en la franja nocturna configurada (hoy, de 21 a 6 h).</dd>
          </div>
          <div>
            <dt>Horas de feriado</dt>
            <dd>Las trabajadas en un día cargado como feriado.</dd>
          </div>
          <div>
            <dt>Puntual · Tarde · Ausente</dt>
            <dd>
              Se compara la entrada con el turno asignado. Hay unos minutos de tolerancia antes de contar
              «Tarde». «Ausente» significa que no hay una entrada y salida completas para ese turno.
            </dd>
          </div>
          <div>
            <dt>Fuera del local · Sin ubicación</dt>
            <dd>
              «Fuera del local»: la marca se hizo lejos, aun descontando el error del GPS. «Sin ubicación»: no se
              compartió o el celular no la pudo obtener. «GPS impreciso»: no se pudo confirmar. En todos los casos la
              marca cuenta; es un aviso para revisar.
            </dd>
          </div>
          <div>
            <dt>Borrador · Publicado</dt>
            <dd>Un turno en borrador solo lo ve el dueño. Publicado, lo ve también el empleado.</dd>
          </div>
        </dl>
        <p className="callout info small">
          Estas reglas son ajustes del comercio, no asesoramiento legal. Antes de usarlas para liquidar sueldos,
          conviene validarlas con el contador o un laboralista según el convenio que corresponda.
        </p>
      </section>

      <section id="instalar" className="card help-section" aria-labelledby="h-instalar">
        <h2 id="h-instalar">Instalar en el celular</h2>
        <p className="muted">Así se abre como una app, sin buscar el enlace cada vez.</p>
        <ul className="tip-list">
          <li>
            <strong>Android (Chrome):</strong> menú ⋮ → <em>Agregar a la pantalla principal</em>.
          </li>
          <li>
            <strong>iPhone (Safari):</strong> botón Compartir → <em>Agregar a inicio</em>.
          </li>
        </ul>
      </section>
    </AppShell>
  );
}
