// =============================================================================
// geocodingProvider.js — Real Geocoding & Reverse Geocoding provider abstraction.
// Uses Photon (Free Komoot OSM) & Nominatim (Free OpenStreetMap) with caching.
// =============================================================================

import config from '../config/env.js';
import providerCache from './base/cache.js';

export const PROVIDER_NAME = 'geocodingProvider';

export async function searchGeocode(text, limit = 5) {
  const query = (text || '').trim();
  if (!query) return [];

  const cacheKey = `search_geocode_v3:${query.toLowerCase()}:${limit}`;
  const cached = providerCache.get('geocode', cacheKey);
  if (cached) return cached;

  let results = [];

  // 1. Nominatim multi-result query (OSM official, sorted by importance)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      results = (json || []).map((r) => ({
        name: r.name || (r.display_name ? r.display_name.split(',')[0].trim() : query),
        address: r.display_name || query,
        label: r.display_name || query,
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
        source: 'nominatim_osm'
      })).filter((r) => !Number.isNaN(r.latitude) && !Number.isNaN(r.longitude));
    }
  } catch (err) {
    console.warn(`[geocodingProvider:nominatim_search] ${err.message}`);
  }

  // 2. Photon fallback if Nominatim returned no results
  if (results.length === 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const features = json.features || [];
        results = features.map((f) => {
          const [lon, lat] = f.geometry?.coordinates || [];
          const p = f.properties || {};
          const label = [p.name, p.county || p.district || p.city, p.state, p.country].filter(Boolean).join(', ');
          return {
            name: p.name || query,
            address: label || query,
            label: label || query,
            latitude: lat,
            longitude: lon,
            source: 'photon_osm'
          };
        }).filter((r) => r.latitude != null && r.longitude != null);
      }
    } catch (err) {
      console.warn(`[geocodingProvider:photon_search] ${err.message}`);
    }
  }

  if (results.length > 0) {
    providerCache.set('geocode', cacheKey, results, 60 * 60 * 1000);
  }

  return results;
}

export async function geocode(text) {
  const query = (text || '').trim();
  if (!query) throw new Error('Geocoding query cannot be empty.');

  // If input is already in "lat,lon" or "lat, lon" format
  const coordMatch = query.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    return {
      lat: parseFloat(coordMatch[1]),
      lon: parseFloat(coordMatch[3]),
      label: query,
      source: 'coordinates'
    };
  }

  const cached = providerCache.get('geocode', query);
  if (cached) return cached;

  let result = null;

  // 1. Nominatim (OSM Official — importance-based ranking for cities/towns)
  result = await geocodeViaNominatim(query);

  // 2. Photon (Komoot OSM search — Free fallback)
  if (!result) {
    result = await geocodeViaPhoton(query);
  }

  // 3. OpenRouteService if configured
  if (!result && config.routing?.openRouteServiceApiKey) {
    result = await geocodeViaOrs(query, config.routing.openRouteServiceApiKey);
  }

  // 4. Google Maps if configured
  if (!result && config.routing?.googleMapsApiKey) {
    result = await geocodeViaGoogle(query, config.routing.googleMapsApiKey);
  }

  if (result) {
    providerCache.set('geocode', query, result, 60 * 60 * 1000); // 1 hour cache
  }

  return result;
}

async function geocodeViaPhoton(text) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const f = json.features?.[0];
      if (f && f.geometry?.coordinates) {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties || {};
        const label = [p.name, p.city || p.district, p.state, p.country].filter(Boolean).join(', ');
        return { lat, lon, label: label || text, source: 'photon_osm' };
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[geocodingProvider:photon] Search failed: ${err.message}`);
  }
  return null;
}

async function geocodeViaNominatim(text) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const r = json?.[0];
      if (r) {
        return {
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          label: r.display_name || text,
          source: 'nominatim_osm'
        };
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[geocodingProvider:nominatim] Search failed: ${err.message}`);
  }
  return null;
}

async function geocodeViaOrs(text, key) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${key}&text=${encodeURIComponent(text)}&size=1`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const f = json.features?.[0];
      if (f && f.geometry?.coordinates) {
        return {
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          label: f.properties?.label || text,
          source: 'openrouteservice'
        };
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[geocodingProvider:ors] Search failed: ${err.message}`);
  }
  return null;
}

async function geocodeViaGoogle(text, key) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${key}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const r = json.results?.[0];
      if (r && r.geometry?.location) {
        return {
          lat: r.geometry.location.lat,
          lon: r.geometry.location.lng,
          label: r.formatted_address || text,
          source: 'google_maps'
        };
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[geocodingProvider:google] Search failed: ${err.message}`);
  }
  return null;
}

// --- Regional Reference Centers (Tamil Nadu / South India) for Instant Fallback ---
const REGIONAL_HUBS = [
  { name: 'Coimbatore', lat: 11.0168, lon: 76.9558, radiusKm: 25 },
  { name: 'Erode', lat: 11.3410, lon: 77.7172, radiusKm: 22 },
  { name: 'Sathyamangalam', lat: 11.5034, lon: 77.2344, radiusKm: 20 },
  { name: 'Salem', lat: 11.6643, lon: 78.1460, radiusKm: 25 },
  { name: 'Tirupur', lat: 11.1085, lon: 77.3411, radiusKm: 20 },
  { name: 'Ooty', lat: 11.4102, lon: 76.6950, radiusKm: 20 },
  { name: 'Pollachi', lat: 10.6609, lon: 77.0048, radiusKm: 20 },
  { name: 'Mettupalayam', lat: 11.3004, lon: 76.9404, radiusKm: 18 },
  { name: 'Dharapuram', lat: 10.7289, lon: 77.5255, radiusKm: 20 },
  { name: 'Gobichettipalayam', lat: 11.4552, lon: 77.4426, radiusKm: 18 },
  { name: 'Bhavani', lat: 11.4468, lon: 77.6833, radiusKm: 16 },
  { name: 'Perundurai', lat: 11.2778, lon: 77.5847, radiusKm: 16 },
  { name: 'Madurai', lat: 9.9252, lon: 78.1198, radiusKm: 28 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, radiusKm: 35 }
];

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findClosestRegionalHub(lat, lon) {
  let closest = null;
  let minKm = Infinity;
  for (const hub of REGIONAL_HUBS) {
    const d = haversineDistance(lat, lon, hub.lat, hub.lon);
    if (d < minKm) {
      minKm = d;
      closest = { ...hub, distanceKm: d };
    }
  }
  return closest;
}

/**
 * Reverse geocode coordinates to locality / city / town name.
 * Priority: 1. Locality / town, 2. City, 3. District, 4. Regional Proximity Hub, 5. Generic.
 */
export async function reverseGeocode(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error('Valid latitude and longitude are required for reverse geocoding.');
  }

  const cacheKey = `reverse_geocode:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = providerCache.get('geocode', cacheKey);
  if (cached) return cached;

  let result = null;

  // 1. Nominatim Reverse (Free OSM, rich address hierarchy)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const addr = json.address || {};
      const town = addr.town || null;
      const city = addr.city || addr.municipality || null;
      const district = addr.district || addr.county || addr.state_district || null;
      const locality = addr.suburb || addr.neighbourhood || addr.quarter || addr.village || addr.locality || null;
      const state = addr.state || 'Tamil Nadu';

      // Prioritize Town/City, then District/Taluk, then Locality
      let destinationName = town || city || district || locality;
      if (destinationName) {
        destinationName = destinationName.replace(/\s+(North|South|East|West|Central|Urban|Rural|District|Taluk)$/i, '').trim();
      }
      if (destinationName) {
        result = {
          destination: destinationName,
          locality,
          city: (city || town || '').replace(/\s+(North|South|East|West|Central|Urban|Rural|District|Taluk)$/i, '').trim() || null,
          district,
          state,
          displayName: json.display_name || destinationName,
          latitude: lat,
          longitude: lon,
          source: 'nominatim_reverse'
        };
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[geocodingProvider:nominatim_reverse] ${err.message}`);
  }

  // 2. Photon Reverse if Nominatim failed
  if (!result) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant)' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const f = json.features?.[0];
        if (f?.properties) {
          const p = f.properties;
          const destinationName = p.locality || p.name || p.city || p.district;
          if (destinationName) {
            result = {
              destination: destinationName,
              locality: p.locality || p.name,
              city: p.city,
              district: p.district,
              state: p.state,
              displayName: [p.name, p.city || p.district, p.state].filter(Boolean).join(', '),
              latitude: lat,
              longitude: lon,
              source: 'photon_reverse'
            };
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[geocodingProvider:photon_reverse] ${err.message}`);
    }
  }

  // 3. Proximity-based regional fallback (Coimbatore, Erode, Sathyamangalam, Salem, etc.)
  if (!result) {
    const hub = findClosestRegionalHub(lat, lon);
    if (hub && hub.distanceKm <= 40) {
      result = {
        destination: hub.name,
        locality: hub.name,
        city: hub.name,
        district: hub.name,
        state: 'Tamil Nadu',
        displayName: `${hub.name}, Tamil Nadu, India`,
        latitude: lat,
        longitude: lon,
        source: 'regional_proximity_hub'
      };
    } else {
      result = {
        destination: 'Local Region',
        locality: null,
        city: null,
        district: null,
        state: 'Tamil Nadu',
        displayName: 'Current Location',
        latitude: lat,
        longitude: lon,
        source: 'fallback'
      };
    }
  }

  if (result) {
    providerCache.set('geocode', cacheKey, result, 60 * 60 * 1000);
  }

  return result;
}
