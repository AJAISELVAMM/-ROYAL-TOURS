// =============================================================================
// haversine.js — geographic distance + bearing helpers (great-circle).
//
// This is a DETERMINISTIC geographic formula (not a trained ML model). It is
// used for nearest-emergency lookups, the A* heuristic, and proximity scoring.
// =============================================================================

const EARTH_RADIUS_KM = 6371;

// Validate a coordinate pair; throws a plain Error carrying a `code` so callers
// can surface a clean 400 without exposing internals.
export function assertValidCoordinates(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  const badLat = !Number.isFinite(latitude) || latitude < -90 || latitude > 90;
  const badLon = !Number.isFinite(longitude) || longitude < -180 || longitude > 180;
  if (badLat) {
    const e = new Error('Invalid latitude: must be a number between -90 and 90.');
    e.code = 'INVALID_LATITUDE';
    throw e;
  }
  if (badLon) {
    const e = new Error('Invalid longitude: must be a number between -180 and 180.');
    e.code = 'INVALID_LONGITUDE';
    throw e;
  }
  return { lat: latitude, lon: longitude };
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Haversine distance in kilometres between two coordinate pairs.
export function haversineKm(lat1, lon1, lat2, lon2) {
  const a = assertValidCoordinates(lat1, lon1);
  const b = assertValidCoordinates(lat2, lon2);
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Distance in metres.
export function haversineMeters(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000;
}

// Initial bearing (degrees 0-360) from point A to point B.
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const a = assertValidCoordinates(lat1, lon1);
  const b = assertValidCoordinates(lat2, lon2);
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI + 360 % 360;
}

// Cardinal compass direction from a bearing (e.g. for turn-by-turn hints).
export function compassDirection(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((deg % 360) / 45) % 8];
}

// Convenience wrapper: full result object.
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const km = haversineKm(lat1, lon1, lat2, lon2);
  return {
    meters: Math.round(km * 1000),
    kilometers: +km.toFixed(3),
    bearing: +bearingDeg(lat1, lon1, lat2, lon2).toFixed(1)
  };
}
