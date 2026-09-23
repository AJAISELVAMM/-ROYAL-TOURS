import { api } from './api.js';

function extractCoords(input) {
  if (!input) return null;
  if (typeof input === 'object') {
    const lat = input.latitude ?? input.lat;
    const lon = input.longitude ?? input.lon ?? input.lng;
    if (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      const nLat = Number(lat);
      const nLon = Number(lon);
      if ((nLat !== 0 || nLon !== 0) && nLat >= -90 && nLat <= 90 && nLon >= -180 && nLon <= 180) {
        return {
          lat: nLat,
          lon: nLon,
          latitude: nLat,
          longitude: nLon,
          label: input.name || input.label || input.address || `${nLat.toFixed(4)}, ${nLon.toFixed(4)}`
        };
      }
    }
  }
  return null;
}

async function fetchDirectOSRM(start, end, mode = 'driving-car', signal) {
  const profile = mode === 'walking' || mode === 'walking_foot' ? 'foot' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)' },
    signal
  });
  if (!res.ok) throw new Error(`OSRM request failed with HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.[0]) {
    throw new Error('OSRM could not calculate route between these locations.');
  }

  const route = json.routes[0];
  const leg = route.legs?.[0];
  const steps = (leg?.steps || []).map((s, i) => ({
    index: i,
    instruction: s.maneuver?.instruction || (s.name ? `Head on ${s.name}` : `Step ${i + 1}`),
    distanceMeters: Math.round(s.distance),
    durationSeconds: Math.round(s.duration)
  }));

  const distKm = +(route.distance / 1000).toFixed(2);
  const durMin = Math.max(1, Math.round(route.duration / 60));

  return {
    distanceKm: distKm,
    durationMinutes: durMin,
    baseDrivingMinutes: durMin,
    steps: steps.length > 0 ? steps : [{ index: 0, instruction: 'Follow the highlighted road route', distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration) }],
    geometry: route.geometry,
    origin: start,
    destination: end,
    provider: 'osrm_direct'
  };
}

export async function getRoute({ from, to, mode = 'driving-car', origin, destination, signal }) {
  const start = from || origin;
  const end = to || destination;
  const startCoords = extractCoords(start);
  const endCoords = extractCoords(end);

  try {
    const body = { from: start, to: end, origin: start, destination: end, mode };
    const data = await api.post('/navigation/route', body, { signal });
    return {
      distanceKm: data.distanceKm ?? data.route?.distance ?? 0,
      durationMinutes: data.durationMinutes ?? data.route?.duration ?? 0,
      baseDrivingMinutes: data.baseDrivingMinutes ?? data.route?.duration ?? data.durationMinutes ?? 0,
      steps: data.steps || data.route?.steps || [],
      geometry: data.geometry || (data.route?.coordinates ? { type: 'LineString', coordinates: data.route.coordinates } : null),
      origin: data.origin || startCoords || null,
      destination: data.destination || endCoords || null,
      provider: data.provider || 'osrm'
    };
  } catch (err) {
    if (signal?.aborted) throw err;

    // Resilient fallback to direct OSRM if both coordinates are known
    if (startCoords && endCoords) {
      console.warn('[transportService] Backend route failed, using direct OSRM router fallback:', err?.message);
      return await fetchDirectOSRM(startCoords, endCoords, mode, signal);
    }
    throw err;
  }
}

