// =============================================================================
// policeProvider.js — Police Station / Law Enforcement data provider.
// Primary: NCRB / State Police GIS Directory / OGD.
// Open-data fallback: OpenStreetMap Overpass (amenity=police).
// Local fallback: Prisma EmergencyService (type: POLICE).
// =============================================================================

import prisma from '../config/database.js';
import config from '../config/env.js';
import { queryOverpass, buildAroundQuery, getElementCoords } from './base/overpassClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';
import * as geoapifyProvider from './geoapifyProvider.js';

export const PROVIDER_NAME = 'policeProvider';

export async function searchPoliceStations({
  latitude,
  longitude,
  radius = 12000,
  search = '',
  limit = 20
} = {}) {
  const provider = (config.police?.provider || process.env.POLICE_PROVIDER || (config.geoapifyApiKey ? 'geoapify' : 'overpass')).toLowerCase();
  const cacheKey = `police:${latitude || ''}:${longitude || ''}:${radius}:${search}:${limit}:${provider}`;

  const cached = providerCache.get('police', cacheKey);
  if (cached) return cached;

  let results = [];

  // Tier 1a: Geoapify Places API if configured
  if (provider === 'geoapify' || config.geoapifyApiKey) {
    results = await geoapifyProvider.searchPolice({
      latitude,
      longitude,
      radiusMeters: radius,
      search,
      limit
    });
  }

  // Tier 1b: Overpass OSM Live Police query if Geoapify was empty or not active
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromOverpass(latitude, longitude, radius, limit);
  }

  // Tier 2: Filtering
  if (search && results.length > 0) {
    const q = search.toLowerCase();
    results = results.filter((p) => p.name.toLowerCase().includes(q) || (p.address && p.address.toLowerCase().includes(q)));
  }

  // Tier 3: Database fallback
  if (results.length === 0) {
    results = await fetchFromDatabase({ latitude, longitude, search, limit });
  }

  const finalItems = results.slice(0, limit);
  if (finalItems.length > 0) {
    providerCache.set('police', cacheKey, finalItems, 15 * 60 * 1000);
  }

  return finalItems;
}

async function fetchFromOverpass(lat, lon, radius, limit) {
  const selectors = [
    'node["amenity"="police"]',
    'way["amenity"="police"]'
  ];

  const query = buildAroundQuery(lat, lon, radius, selectors);
  const elements = await queryOverpass(query, { cacheKey: `overpass_police_${lat}_${lon}_${radius}` });

  return elements
    .map((el) => {
      const tags = el.tags || {};
      const coords = getElementCoords(el);
      if (coords.latitude == null || coords.longitude == null) return null;

      const phone = tags.phone || tags['contact:phone'] || '100';
      const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);

      return normalizePoi({
        id: `osm_police_${el.type}_${el.id}`,
        name: tags.name || tags['name:en'] || 'Police Station',
        category: 'police',
        address: formatAddressFromOsmTags(tags),
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone,
        rating: null,
        reviews: 0,
        openingHours: '24/7 (Emergency Help)',
        description: tags.description || 'Law enforcement & tourist safety station',
        source: 'open_public_osm',
        sourceUrl: tags.website || (tags['wikidata'] ? `https://www.wikidata.org/wiki/${tags['wikidata']}` : 'https://www.openstreetmap.org'),
        verified: Boolean(tags.wikidata || tags.operator),
        distanceKm: dist,
        extra: {
          openStatus: 'OPEN',
          type: 'POLICE'
        }
      });
    })
    .filter(Boolean)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
    .slice(0, limit);
}

async function fetchFromDatabase({ latitude, longitude, search, limit }) {
  try {
    const where = { type: 'POLICE', active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    const records = await prisma.emergencyService.findMany({
      where,
      take: limit || 20
    });

    return records.map((p) => {
      const dist = latitude != null && longitude != null && p.latitude != null && p.longitude != null
        ? haversineDistanceKm(latitude, longitude, p.latitude, p.longitude)
        : null;

      return normalizePoi({
        id: p.id,
        name: p.name,
        category: 'police',
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        phone: p.phone || '100',
        rating: null,
        reviews: 0,
        openingHours: '24/7 Law Enforcement',
        description: 'Government Police Station / Tourist Help Point',
        source: p.source || 'seed_database',
        sourceUrl: null,
        verified: true,
        distanceKm: dist,
        extra: {
          openStatus: 'OPEN',
          type: 'POLICE'
        }
      });
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[policeProvider] DB fallback failed: ${err.message}`);
    return [];
  }
}
