// =============================================================================
// transportProvider.js — Public Transport (Bus stops, Metro, Tram, Local Transit).
// Primary: State Road Transport / Open Transit GTFS / Open City.
// Open-data fallback: OpenStreetMap Overpass (highway=bus_stop, public_transport=stop_position, railway=subway_entrance).
// Local fallback: Prisma TransportRoute table.
// =============================================================================

import prisma from '../config/database.js';
import config from '../config/env.js';
import { queryOverpass, buildAroundQuery, getElementCoords } from './base/overpassClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';
import * as geoapifyProvider from './geoapifyProvider.js';

export const PROVIDER_NAME = 'transportProvider';

export async function searchTransportStops({
  latitude,
  longitude,
  radius = 6000,
  mode = null, // bus | metro | train | all
  limit = 25
} = {}) {
  const provider = (config.transport?.provider || process.env.TRANSPORT_PROVIDER || (config.geoapifyApiKey ? 'geoapify' : 'overpass')).toLowerCase();
  const cacheKey = `transport:${latitude || ''}:${longitude || ''}:${radius}:${mode || 'all'}:${limit}:${provider}`;

  const cached = providerCache.get('transport', cacheKey);
  if (cached) return cached;

  let results = [];

  // Tier 1a: Geoapify Places API if configured
  if (provider === 'geoapify' || config.geoapifyApiKey) {
    results = await geoapifyProvider.searchTransport({
      latitude,
      longitude,
      radiusMeters: radius,
      limit
    });
  }

  // Tier 1b: Overpass OSM live public transit query if Geoapify was empty or not active
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromOverpass(latitude, longitude, radius, mode, limit);
  }

  // Tier 2: Database fallback
  if (results.length === 0) {
    results = await fetchFromDatabase({ latitude, longitude, limit });
  }

  const finalItems = results.slice(0, limit);
  if (finalItems.length > 0) {
    providerCache.set('transport', cacheKey, finalItems, 15 * 60 * 1000);
  }

  return finalItems;
}

async function fetchFromOverpass(lat, lon, radius, mode, limit) {
  let selectors = [
    'node["highway"="bus_stop"]',
    'node["public_transport"="platform"]',
    'node["railway"="subway_entrance"]',
    'node["railway"="tram_stop"]'
  ];

  if (mode === 'bus') {
    selectors = ['node["highway"="bus_stop"]', 'node["public_transport"="platform"]["bus"="yes"]'];
  } else if (mode === 'metro' || mode === 'subway') {
    selectors = ['node["railway"="subway_entrance"]', 'node["station"="subway"]'];
  }

  const query = buildAroundQuery(lat, lon, radius, selectors);
  const elements = await queryOverpass(query, { cacheKey: `overpass_transport_${lat}_${lon}_${radius}_${mode || 'all'}` });

  return elements
    .map((el) => {
      const tags = el.tags || {};
      const coords = getElementCoords(el);
      if (coords.latitude == null || coords.longitude == null) return null;

      let transportMode = 'Bus';
      if (tags.railway === 'subway_entrance' || tags.station === 'subway') transportMode = 'Metro';
      else if (tags.railway === 'tram_stop') transportMode = 'Tram';

      const routes = tags.routes || tags.bus_routes || tags['route_ref'] || null;
      const operator = tags.operator || tags.network || 'Public City Transport';
      const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);

      return normalizePoi({
        id: `osm_transit_${el.type}_${el.id}`,
        name: tags.name || tags['name:en'] || `${transportMode} Stop`,
        category: 'public_transport',
        address: formatAddressFromOsmTags(tags) || `${operator} Network`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone: null,
        rating: null,
        reviews: 0,
        openingHours: tags.opening_hours || '05:30 AM – 11:00 PM',
        description: routes ? `Routes serving this stop: ${routes}` : `${transportMode} Stop (${operator})`,
        source: 'open_public_osm',
        sourceUrl: 'https://www.openstreetmap.org',
        verified: true,
        distanceKm: dist,
        extra: {
          mode: transportMode,
          operator,
          routes
        }
      });
    })
    .filter(Boolean)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
    .slice(0, limit);
}

async function fetchFromDatabase({ latitude, longitude, limit }) {
  try {
    const records = await prisma.transportRoute.findMany({
      take: limit || 10,
      orderBy: { price: 'asc' }
    });

    return records.map((r) => {
      return normalizePoi({
        id: r.id,
        name: `${r.from} to ${r.to} (${r.mode.toUpperCase()})`,
        category: 'public_transport',
        address: `${r.from} — ${r.to}`,
        latitude: latitude || 11.0046,
        longitude: longitude || 76.9659,
        phone: null,
        rating: null,
        reviews: 0,
        openingHours: 'Regular Service',
        description: `Trip duration: ${r.duration}, Estimated Fare: ₹${r.price}`,
        source: 'seed_database',
        sourceUrl: null,
        verified: true,
        distanceKm: r.distanceKm,
        extra: {
          mode: r.mode,
          price: r.price,
          duration: r.duration,
          label: r.label
        }
      });
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[transportProvider] DB fallback failed: ${err.message}`);
    return [];
  }
}
