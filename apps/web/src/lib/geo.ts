import type { GeoPoint } from "@turnos/core";

/**
 * Ubicación del empleado: se pide UNA vez, en el instante de fichar, y solo con su consentimiento.
 * Nunca hay seguimiento (no se usa watchPosition ni se pide en segundo plano).
 */

const CONSENT_KEY = "turnos:geo-consent";

/** "granted": aceptó compartirla al fichar. "declined": prefirió fichar sin ubicación. null: todavía no eligió. */
export type GeoConsent = "granted" | "declined" | null;

export function getConsent(): GeoConsent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: Exclude<GeoConsent, null>): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Sin almacenamiento se vuelve a preguntar la próxima vez: es lo más respetuoso.
  }
}

export type PositionError = "unsupported" | "denied" | "unavailable" | "timeout";

/** Una sola lectura, sin caché (maximumAge 0) para que corresponda a este momento. */
export function currentPosition(timeoutMs = 10_000): Promise<GeoPoint | { error: PositionError }> {
  if (!("geolocation" in navigator)) return Promise.resolve({ error: "unsupported" });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Math.round(pos.coords.accuracy) }),
      (err) =>
        resolve({
          error: err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable",
        }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
  });
}

export const POSITION_ERROR_TEXT: Record<PositionError, string> = {
  unsupported: "Este celular no permite obtener la ubicación.",
  denied: "El celular no dio permiso para usar la ubicación.",
  unavailable: "No se pudo obtener la ubicación (¿GPS apagado?).",
  timeout: "La ubicación tardó demasiado.",
};
