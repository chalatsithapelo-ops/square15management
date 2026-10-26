// Geospatial helpers for anti-collusion + geofence checks.
// All functions are pure. No I/O.

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance (haversine) between two WGS84 points, in meters. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/** Default geofence radius (meters). Fail-open when site coords absent. */
export const DEFAULT_GEOFENCE_METERS = 200;

/** Join-code TTL in minutes (short-lived to reduce sharing/collusion). */
export const JOIN_CODE_TTL_MINUTES = 15;

export function joinCodeExpiryFromNow(): Date {
  return new Date(Date.now() + JOIN_CODE_TTL_MINUTES * 60_000);
}

export function isValidCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -180 && n <= 180;
}
