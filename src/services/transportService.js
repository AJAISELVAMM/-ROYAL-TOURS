// ============================================================================
// transportService — real road route + fare against TourGuard deterministic OSRM API.
// No AI rate limit or intelligence model dependencies.
// ============================================================================

import { api } from './api.js';

export async function getRoute({ from, to, mode = 'driving-car', origin, destination, signal }) {
  const start = from || origin;
  const end = to || destination;
  const body = { from: start, to: end, origin: start, destination: end, mode };
  
  const data = await api.post('/navigation/route', body, { signal });
  return {
    distanceKm: data.distanceKm ?? data.route?.distance ?? 0,
    durationMinutes: data.durationMinutes ?? data.route?.duration ?? 0,
    baseDrivingMinutes: data.baseDrivingMinutes ?? data.route?.duration ?? data.durationMinutes ?? 0,
    steps: data.steps || data.route?.steps || [],
    geometry: data.geometry || (data.route?.coordinates ? { type: 'LineString', coordinates: data.route.coordinates } : null),
    origin: data.origin || null,
    destination: data.destination || null,
    provider: data.provider || 'osrm'
  };
}

