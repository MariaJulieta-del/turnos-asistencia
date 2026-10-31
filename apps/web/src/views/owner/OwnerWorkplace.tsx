import { useEffect, useState, type FormEvent } from "react";
import { Crosshair, MapPin } from "lucide-react";
import type { Workplace } from "@turnos/contract";
import { fetchWorkplace, saveWorkplace } from "../../lib/api";
import { formatDistance } from "../../lib/format";
import { POSITION_ERROR_TEXT, currentPosition } from "../../lib/geo";

const RADII = [50, 100, 200, 500];

/**
 * Lugar de trabajo para verificar dónde fichan los empleados. El dueño lo carga parado en el local
 * ("Usar mi ubicación actual") y elige el radio.
 */
export function OwnerWorkplace({ token }: { token: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Local");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [radiusM, setRadiusM] = useState(100);
  const [saved, setSaved] = useState<Workplace | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchWorkplace(token).then(
      (w) => {
        if (w) {
          setName(w.name);
          setPoint({ lat: w.lat, lng: w.lng });
          setRadiusM(w.radiusM);
          setSaved(w);
        }
        setLoaded(true);
      },
      (e: Error) => setError(e.message),
    );
  }, [token]);

  async function locate() {
    setLocating(true);
    setMessage("");
    const pos = await currentPosition(15_000);
    setLocating(false);
    if ("error" in pos) {
      setMessage(POSITION_ERROR_TEXT[pos.error]);
      return;
    }
    setPoint({ lat: pos.lat, lng: pos.lng });
    setAccuracy(pos.accuracyM);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!point) {
      setMessage("Primero tocá «Usar mi ubicación actual» estando en el local.");
      return;
    }
    setSaving(true);
    try {
      const w = await saveWorkplace(token, { name: name.trim() || "Local", ...point, radiusM });
      setSaved(w);
      setAccuracy(null);
      setMessage("Listo. Desde ahora, al fichar se verifica que estén en el local.");
    } catch (err) {
      setMessage((err as Error).message);
    }
    setSaving(false);
  }

  if (error) return <p className="callout warn">{error}</p>;
  if (!loaded) {
    return (
      <p className="muted" role="status">
        Cargando…
      </p>
    );
  }

  const mapUrl = point ? `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=18/${point.lat}/${point.lng}` : null;

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1>Lugar de trabajo</h1>
        <p className="muted">
          Al fichar, se verifica que el empleado esté dentro de este radio. Si no lo está, la marca se guarda igual y
          aparece para revisar.
        </p>
      </header>

      <form className="card form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="wp-name">Nombre</label>
          <input id="wp-name" type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <span className="field-label">Ubicación</span>
          <p className="muted small">Hacelo parado dentro del local, con el GPS del celular prendido.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={locate} disabled={locating}>
              <Crosshair size={18} aria-hidden="true" />
              {locating ? "Buscando…" : point ? "Volver a tomar mi ubicación" : "Usar mi ubicación actual"}
            </button>
          </div>
          {point && (
            <p className="sync ok small">
              <MapPin size={16} aria-hidden="true" />
              <span>
                Ubicación cargada
                {accuracy !== null && ` (precisión ±${formatDistance(accuracy)})`}.{" "}
                {mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noreferrer">
                    Ver en el mapa
                  </a>
                )}
              </span>
            </p>
          )}
          {accuracy !== null && accuracy > radiusM && (
            <p className="form-error small">
              El GPS tiene más error que el radio elegido. Probá de nuevo cerca de una ventana o elegí un radio mayor.
            </p>
          )}
        </div>

        <fieldset className="field">
          <legend>Radio permitido</legend>
          <div className="chips">
            {RADII.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={radiusM === r} onClick={() => setRadiusM(r)}>
                {formatDistance(r)}
              </button>
            ))}
          </div>
          <p className="muted small">
            100 m alcanza para la mayoría de los locales. Más chico puede marcar como «fuera» a alguien que está adentro,
            porque el GPS en interiores suele tener 20 a 50 m de error.
          </p>
        </fieldset>

        <p className="small" role="status" aria-live="polite">
          {message}
        </p>

        <div className="modal-actions">
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Guardando…" : saved ? "Guardar cambios" : "Guardar lugar de trabajo"}
          </button>
        </div>
      </form>

      <section className="callout info small" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="callout-title">
          Privacidad de los empleados
        </h2>
        <ul className="tip-list">
          <li>La ubicación se lee solo en el instante de fichar, nunca en otro momento.</li>
          <li>Cada empleado elige si la comparte. Si no, puede fichar igual y la marca aparece para revisar.</li>
          <li>No se guardan coordenadas de los empleados: solo si estaban en el local y a qué distancia.</li>
          <li>
            Antes de usarlo, conviene informarlo por escrito y consultarlo con un laboralista (Ley 25.326 de datos
            personales).
          </li>
        </ul>
      </section>
    </div>
  );
}
