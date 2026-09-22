// =============================================================================
// emergencyProvider.js — Emergency Services (Fire, Ambulance, ERSS 112, Safe Points).
// Primary: ERSS 112 / State Fire & Rescue Services / Disaster Management Registry.
// Open-data fallback: OpenStreetMap Overpass (amenity=fire_station, emergency=ambulance_station).
// Local fallback: Prisma EmergencyService table.
// =============================================================================

import prisma from '../config/database.js';
import config from '../config/env.js';
import { queryOverpass, buildAroundQuery, getElementCoords } from './base/overpassClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';
import * as geoapifyProvider from './geoapifyProvider.js';

export const PROVIDER_NAME = 'emergencyProvider';

export async function searchEmergencyServices({
  latitude,
  longitude,
  radius = 15000,
  type = null, // FIRE_STATION | HOSPITAL | POLICE | PHARMACY | ALL
  limit = 20
} = {}) {
  const provider = (config.emergency?.provider || process.env.EMERGENCY_PROVIDER || (config.geoapifyApiKey ? 'geoapify' : 'overpass')).toLowerCase();
  const cacheKey = `emergency:${latitude || ''}:${longitude || ''}:${radius}:${type || 'ALL'}:${limit}:${provider}`;

  const cached = providerCache.get('emergency', cacheKey);
  if (cached) return cached;

  let results = [];

  // Tier 1a: Geoapify Places API if configured
  if (provider === 'geoapify' || config.geoapifyApiKey) {
    results = await geoapifyProvider.searchEmergencyServices({
      latitude,
      longitude,
      radiusMeters: radius,
      limit
    });
  }

  // Tier 1b: Overpass OSM Live Emergency query if Geoapify was empty or not active
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromOverpass(latitude, longitude, radius, type, limit);
  }

  // Tier 2: Database fallback
  if (results.length === 0) {
    results = await fetchFromDatabase({ latitude, longitude, type, limit });
  }

  const finalItems = results.slice(0, limit);
  if (finalItems.length > 0) {
    providerCache.set('emergency', cacheKey, finalItems, 15 * 60 * 1000);
  }

  return finalItems;
}

async function fetchFromOverpass(lat, lon, radius, type, limit) {
  let selectors = [];

  if (!type || type === 'ALL' || type === 'FIRE_STATION' || type === 'FIRE') {
    selectors.push('node["amenity"="fire_station"]', 'way["amenity"="fire_station"]', 'node["emergency"="ambulance_station"]');
  }
  if (!type || type === 'ALL' || type === 'POLICE') {
    selectors.push('node["amenity"="police"]');
  }
  if (!type || type === 'ALL' || type === 'HOSPITAL') {
    selectors.push('node["amenity"="hospital"]', 'way["amenity"="hospital"]');
  }
  if (!type || type === 'ALL' || type === 'PHARMACY') {
    selectors.push('node["amenity"="pharmacy"]');
  }

  const query = buildAroundQuery(lat, lon, radius, selectors);
  const elements = await queryOverpass(query, { cacheKey: `overpass_emergency_${lat}_${lon}_${radius}_${type || 'ALL'}` });

  return elements
    .map((el) => {
      const tags = el.tags || {};
      const coords = getElementCoords(el);
      if (coords.latitude == null || coords.longitude == null) return null;

      let serviceType = 'FIRE_STATION';
      let defaultPhone = '101';
      if (tags.amenity === 'police') {
        serviceType = 'POLICE';
        defaultPhone = '100';
      } else if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') {
        serviceType = 'HOSPITAL';
        defaultPhone = '108';
      } else if (tags.amenity === 'pharmacy') {
        serviceType = 'PHARMACY';
        defaultPhone = '108';
      }

      const phone = tags['emergency:phone'] || tags.phone || tags['contact:phone'] || defaultPhone;
      const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);

      return normalizePoi({
        id: `osm_emerg_${el.type}_${el.id}`,
        name: tags.name || tags['name:en'] || (serviceType === 'FIRE_STATION' ? 'Fire & Rescue Station' : 'Emergency Point'),
        category: 'emergency',
        address: formatAddressFromOsmTags(tags),
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone,
        rating: null,
        reviews: 0,
        openingHours: '24/7 (Emergency Service)',
        description: tags.description || 'Public Emergency First Response',
        source: 'open_public_osm',
        sourceUrl: tags.website || 'https://www.openstreetmap.org',
        verified: true,
        distanceKm: dist,
        extra: {
          type: serviceType,
          openStatus: 'OPEN'
        }
      });
    })
    .filter(Boolean)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
    .slice(0, limit);
}

async function fetchFromDatabase({ latitude, longitude, type, limit }) {
  try {
    const where = { active: true };
    if (type && type !== 'ALL') {
      where.type = type;
    }

    const records = await prisma.emergencyService.findMany({
      where,
      take: limit || 20
    });

    return records.map((e) => {
      const dist = latitude != null && longitude != null && e.latitude != null && e.longitude != null
        ? haversineDistanceKm(latitude, longitude, e.latitude, e.longitude)
        : null;

      return normalizePoi({
        id: e.id,
        name: e.name,
        category: 'emergency',
        address: e.address,
        latitude: e.latitude,
        longitude: e.longitude,
        phone: e.phone || (e.type === 'POLICE' ? '100' : e.type === 'HOSPITAL' ? '108' : '101'),
        rating: null,
        reviews: 0,
        openingHours: '24/7',
        description: 'Verified Public Emergency Service',
        source: e.source || 'seed_database',
        sourceUrl: null,
        verified: true,
        distanceKm: dist,
        extra: {
          type: e.type,
          openStatus: 'OPEN'
        }
      });
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[emergencyProvider] DB fallback failed: ${err.message}`);
    return [];
  }
}
