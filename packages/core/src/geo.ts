/**
 * Verificación de ubicación al fichar. Solo se usa en el instante de la marca, con consentimiento.
 * Nunca decide si una marca vale: el resultado es un aviso para que el dueño revise.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
  /** Radio de error que informa el GPS, en metros. */
  accuracyM: number;
}

export interface Geofence {
  lat: number;
  lng: number;
  radiusM: number;
}

/** INSIDE: estaba en el local. OUTSIDE: seguro afuera, aun con el error del GPS. UNCERTAIN: no se puede asegurar. */
export type GeofenceStatus = "INSIDE" | "OUTSIDE" | "UNCERTAIN";

export interface GeofenceCheck {
  status: GeofenceStatus;
  /** Distancia al local más cercano, en metros (redondeada). */
  distanceM: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en metros entre dos puntos (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Compara la ubicación de la marca con los locales del comercio (alcanza con estar en uno).
 * - OUTSIDE solo si está afuera incluso descontando el error del GPS: no acusa por un GPS impreciso.
 * - INSIDE si el punto cae en el radio y el GPS es razonablemente preciso (`maxAccuracyM`, default 250 m).
 * - UNCERTAIN en el resto (ej. ubicación por WiFi/antena con error de 1 km).
 * Devuelve null si el comercio no tiene locales con geovalla.
 */
export function checkGeofence(
  point: GeoPoint,
  fences: readonly Geofence[],
  maxAccuracyM = 250,
): GeofenceCheck | null {
  if (fences.length === 0) return null;
  let best: { fence: Geofence; d: number } | null = null;
  for (const fence of fences) {
    const d = distanceMeters(point, fence);
    // El local "más cercano" es el que tiene el borde más cerca, no el centro.
    if (!best || d - fence.radiusM < best.d - best.fence.radiusM) best = { fence, d };
  }
  const { fence, d } = best!;
  const accuracy = Math.max(0, point.accuracyM);
  const distanceM = Math.round(d);
  if (d - accuracy > fence.radiusM) return { status: "OUTSIDE", distanceM };
  if (d <= fence.radiusM && accuracy <= maxAccuracyM) return { status: "INSIDE", distanceM };
  return { status: "UNCERTAIN", distanceM };
}
