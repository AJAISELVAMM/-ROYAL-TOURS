// =============================================================================
// routingProvider.js — Real Map & Road Routing provider abstraction.
// Default: OpenStreetMap OSRM public server (Free, open public road data, no API key required).
// Optional: OpenRouteService, Google Maps (if API keys are provided).
// =============================================================================

import config from '../../config/env.js';
import { geocode as geocodeLocation } from '../geocodingProvider.js';
import { badRequest, serviceUnavailable } from '../../utils/errors.js';

export function routingConfigured() {
  return true;
}

export async function resolveCoordinates(input) {
  if (!input) return null;

  // 1. If already an object with lat/lon or latitude/longitude
  if (typeof input === 'object') {
    const lat = input.lat ?? input.latitude;
    const lon = input.lon ?? input.longitude ?? input.lng;
    if (lat != null && lon != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon))) {
      return {
        lat: Number(lat),
        lon: Number(lon),
        label: input.label || input.name || `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`
      };
    }
  }

  // 2. If array [lon, lat] or [lat, lon]
  if (Array.isArray(input) && input.length >= 2) {
    // In India lat is ~8-37, lon is ~68-98
    if (input[0] > input[1] && input[0] > 45) {
      return { lon: Number(input[0]), lat: Number(input[1]), label: `${input[1]}, ${input[0]}` };
    }
    return { lat: Number(input[0]), lon: Number(input[1]), label: `${input[0]}, ${input[1]}` };
  }

  // 3. If string "lat, lon" or "lat,lon"
  const str = String(input).trim();
  const coordMatch = str.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    return {
      lat: parseFloat(coordMatch[1]),
      lon: parseFloat(coordMatch[3]),
      label: str
    };
  }

  // 4. Otherwise geocode the text location
  const result = await geocodeLocation(str);
  if (!result) throw badRequest(`Unable to locate '${str}'.`, 'GEOCODE_ERROR');
  return result;
}

async function osrmDirections(start, end, mode = 'driving') {
  try {
    const osrmProfile = mode === 'walking' || mode === 'walking_foot' ? 'foot' : 'driving';
    // OSRM expects {start_lon},{start_lat};{end_lon},{end_lat}
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.[0]) return null;

    const route = json.routes[0];
    const leg = route.legs?.[0];
    const steps = (leg?.steps || []).map((s, i) => ({
      index: i,
      instruction: s.maneuver?.instruction || (s.name ? `Head on ${s.name}` : `Step ${i + 1}`),
      distanceMeters: Math.round(s.distance),
      durationSeconds: Math.round(s.duration)
    }));

    return {
      geometry: route.geometry || null,
      distanceKm: +(route.distance / 1000).toFixed(2),
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      steps: steps.length > 0 ? steps : [
        { index: 0, instruction: 'Follow the highlighted route', distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration) }
      ],
      source: 'osrm_open_data',
      provider: 'osrm'
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[routingProvider:osrm] Request failed: ${err.message}`);
    return null;
  }
}

async function orsDirections(start, end, profile = 'driving-car') {
  const key = config.routing?.openRouteServiceApiKey;
  if (!key) return null;

  try {
    const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [start, end] }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = await res.json();
    const feature = json.features?.[0];
    const seg = feature?.properties?.segments?.[0];
    const steps = (seg?.steps || []).map((s, i) => ({
      index: i,
      instruction: s.instruction,
      distanceMeters: Math.round(s.distance),
      durationSeconds: Math.round(s.duration)
    }));
    return {
      geometry: feature?.geometry || null,
      distanceKm: +(seg?.distance / 1000).toFixed(2) || 0,
      durationMinutes: Math.round((seg?.duration || 0) / 60),
      steps,
      source: 'openrouteservice',
      provider: 'openrouteservice'
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[routingProvider:ors] Request failed: ${err.message}`);
    return null;
  }
}

async function googleDirections(start, end) {
  const key = config.routing?.googleMapsApiKey;
  if (!key) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${start[1]},${start[0]}&destination=${end[1]},${end[0]}&key=${key}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 'OK') return null;
    const route = json.routes[0];
    const legs = route.legs[0];
    return {
      geometry: route.overview_polyline,
      distanceKm: +(legs.distance.value / 1000).toFixed(2),
      durationMinutes: Math.round(legs.duration.value / 60),
      steps: legs.steps.map((s, i) => ({
        index: i,
        instruction: s.html_instructions?.replace(/<[^>]+>/g, ''),
        distanceMeters: s.distance.value,
        durationSeconds: s.duration.value
      })),
      source: 'google_maps',
      provider: 'google'
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[routingProvider:google] Request failed: ${err.message}`);
    return null;
  }
}

export async function geocode(text) {
  return resolveCoordinates(text);
}

export async function getRoute({ from, to, mode = 'driving-car' }) {
  if (!from || !to) throw badRequest('Both origin (from) and destination (to) are required.', 'ROUTING_ERROR');

  const start = await resolveCoordinates(from);
  const end = await resolveCoordinates(to);
  if (!start) throw badRequest(`Unable to locate start origin.`, 'GEOCODE_ERROR');
  if (!end) throw badRequest(`Unable to locate destination.`, 'GEOCODE_ERROR');

  const startCoord = [start.lon, start.lat];
  const endCoord = [end.lon, end.lat];

  const profile = mode === 'walking' || mode === 'walking_foot' ? 'walking' : 'driving';

  let routeResult = null;

  // 1. Primary No-Key Provider: OSRM Public Router (Free OSM road network)
  routeResult = await osrmDirections(startCoord, endCoord, profile);

  // 2. OpenRouteService if configured
  if (!routeResult && config.routing?.openRouteServiceApiKey) {
    routeResult = await orsDirections(startCoord, endCoord, profile === 'walking' ? 'foot-walking' : 'driving-car');
  }

  // 3. Google Maps if configured
  if (!routeResult && config.routing?.googleMapsApiKey) {
    routeResult = await googleDirections(startCoord, endCoord);
  }

  // 4. If all live routing providers are down, throw clear error (no fake straight line routes)
  if (!routeResult) {
    throw serviceUnavailable('Live road routing service is temporarily unavailable. Please check internet connectivity.', 'ROUTING_UNAVAILABLE');
  }

  return {
    ...routeResult,
    origin: start,
    destination: end
  };
}
