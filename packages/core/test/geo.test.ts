import { describe, expect, it } from "vitest";
import { checkGeofence, distanceMeters } from "../src/index";

// Plaza San Martín, Córdoba.
const LOCAL = { lat: -31.4167, lng: -64.1837, radiusM: 100 };
/** Punto a `metros` al norte del local. */
const north = (metros: number, accuracyM = 15) => ({ lat: LOCAL.lat + metros / 111_195, lng: LOCAL.lng, accuracyM });

describe("distanceMeters", () => {
  it("mide distancias cortas con precisión de metros", () => {
    expect(distanceMeters(LOCAL, north(500))).toBeCloseTo(500, 0);
    expect(distanceMeters(LOCAL, LOCAL)).toBe(0);
  });

  it("Córdoba–Buenos Aires da unos 646 km", () => {
    const d = distanceMeters(LOCAL, { lat: -34.6037, lng: -58.3816 });
    expect(d / 1000).toBeGreaterThan(640);
    expect(d / 1000).toBeLessThan(652);
  });
});

describe("checkGeofence", () => {
  it("dentro del radio con buen GPS: INSIDE", () => {
    expect(checkGeofence(north(40), [LOCAL])).toEqual({ status: "INSIDE", distanceM: 40 });
  });

  it("lejos aun descontando el error del GPS: OUTSIDE", () => {
    expect(checkGeofence(north(850, 30), [LOCAL])).toEqual({ status: "OUTSIDE", distanceM: 850 });
  });

  it("no acusa si el error del GPS alcanza para estar adentro: UNCERTAIN", () => {
    // A 150 m con 80 m de error: podría estar a 70 m (adentro).
    expect(checkGeofence(north(150, 80), [LOCAL])?.status).toBe("UNCERTAIN");
  });

  it("un punto adentro pero con GPS muy impreciso no se da por verificado", () => {
    expect(checkGeofence(north(20, 1200), [LOCAL])?.status).toBe("UNCERTAIN");
  });

  it("con varios locales alcanza con estar en uno", () => {
    const otro = { lat: -31.43, lng: -64.19, radiusM: 100 };
    expect(checkGeofence({ lat: otro.lat, lng: otro.lng, accuracyM: 10 }, [LOCAL, otro])?.status).toBe("INSIDE");
  });

  it("sin locales configurados no hay verificación", () => {
    expect(checkGeofence(north(10), [])).toBeNull();
  });
});
