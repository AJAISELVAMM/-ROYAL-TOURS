/**
 * geoUtils.js — Geographic mathematical calculations:
 * Haversine distance, cross-track distance to polyline (off-route detection),
 * bearing, formatters.
 */

const EARTH_RADIUS_METERS = 6371000;
const EARTH_RADIUS_KM = 6371;

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Great-circle distance between two points in kilometers.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Distance in meters between two points.
 */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const km = haversineDistanceKm(lat1, lon1, lat2, lon2);
  return km != null ? km * 1000 : null;
}

/**
 * Initial bearing from point 1 to point 2 in degrees (0..360).
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

/**
 * Shortest distance in meters from a point (lat, lon) to a line segment (latA, lonA) -> (latB, lonB).
 */
export function distanceToSegmentMeters(lat, lon, latA, lonA, latB, lonB) {
  // Convert spherical coords to local equirectangular projection for fast segment projection
  const x = toRadians(lon - lonA) * Math.cos(toRadians((latA + lat) / 2));
  const y = toRadians(lat - latA);
  const dx = toRadians(lonB - lonA) * Math.cos(toRadians((latA + latB) / 2));
  const dy = toRadians(latB - latA);

  const segLengthSq = dx * dx + dy * dy;
  if (segLengthSq === 0) {
    return distanceMeters(lat, lon, latA, lonA);
  }

  // Project point onto segment: t in [0, 1]
  const t = Math.max(0, Math.min(1, (x * dx + y * dy) / segLengthSq));
  const projX = t * dx;
  const projY = t * dy;

  const distRad = Math.sqrt((x - projX) * (x - projX) + (y - projY) * (y - projY));
  return distRad * EARTH_RADIUS_METERS;
}

/**
 * Off-route detection:
 * Checks whether current point (lat, lon) is farther than thresholdMeters (default: 50m)
 * from every segment in a route's polyline coordinates.
 *
 * @param {number} lat - Tourist latitude
 * @param {number} lon - Tourist longitude
 * @param {Array<[number, number]>} polylineCoords - Array of [lat, lon] or GeoJSON [lon, lat] points
 * @param {number} thresholdMeters - Deviation distance threshold (meters)
 * @param {boolean} isGeoJson - True if coordinates are [lon, lat]
 * @returns {{ isOffRoute: boolean, minDistanceMeters: number }}
 */
export function checkOffRoute(lat, lon, polylineCoords, thresholdMeters = 50, isGeoJson = true) {
  if (!lat || !lon || !polylineCoords || polylineCoords.length < 2) {
    return { isOffRoute: false, minDistanceMeters: 0 };
  }

  let minDistance = Infinity;

  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const ptA = polylineCoords[i];
    const ptB = polylineCoords[i + 1];

    const latA = isGeoJson ? ptA[1] : ptA[0];
    const lonA = isGeoJson ? ptA[0] : ptA[1];
    const latB = isGeoJson ? ptB[1] : ptB[0];
    const lonB = isGeoJson ? ptB[0] : ptB[1];

    const dist = distanceToSegmentMeters(lat, lon, latA, lonA, latB, lonB);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return {
    isOffRoute: minDistance > thresholdMeters,
    minDistanceMeters: Math.round(minDistance)
  };
}

export function formatDistance(km) {
  if (km == null || Number.isNaN(km)) return '—';
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
