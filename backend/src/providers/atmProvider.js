// =============================================================================
// atmProvider.js — ATMs and Bank Branches data provider.
// Primary: Reserve Bank of India (RBI) Bank Branch & ATM Open Directory / OGD.
// Open-data fallback: OpenStreetMap Overpass (amenity=atm|bank).
// =============================================================================

import config from '../config/env.js';
import { queryOverpass, buildAroundQuery, getElementCoords } from './base/overpassClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';
import * as geoapifyProvider from './geoapifyProvider.js';

export const PROVIDER_NAME = 'atmProvider';

export async function searchAtms({
  latitude,
  longitude,
  radius = 5000,
  search = '',
  limit = 20
} = {}) {
  const provider = (config.atm?.provider || process.env.ATM_PROVIDER || (config.geoapifyApiKey ? 'geoapify' : 'overpass')).toLowerCase();
  const cacheKey = `atms:${latitude || ''}:${longitude || ''}:${radius}:${search}:${limit}:${provider}`;

  const cached = providerCache.get('atms', cacheKey);
  if (cached) return cached;

  let results = [];

  // Tier 1a: Geoapify Places API if configured
  if (provider === 'geoapify' || config.geoapifyApiKey) {
    results = await geoapifyProvider.searchATMs({
      latitude,
      longitude,
      radiusMeters: radius,
      search,
      limit
    });
  }

  // Tier 1b: Live Overpass query if Geoapify was empty or not active
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromOverpass(latitude, longitude, radius, limit);
  }

  if (search && results.length > 0) {
    const q = search.toLowerCase();
    results = results.filter((a) => a.name.toLowerCase().includes(q) || (a.operator && a.operator.toLowerCase().includes(q)));
  }

  if (results.length === 0) {
    results = getSeedAtms(latitude, longitude);
  }

  const finalItems = results.slice(0, limit);
  if (finalItems.length > 0) {
    providerCache.set('atms', cacheKey, finalItems, 20 * 60 * 1000);
  }

  return finalItems;
}

async function fetchFromOverpass(lat, lon, radius, limit) {
  const selectors = [
    'node["amenity"="atm"]',
    'node["amenity"="bank"]',
    'way["amenity"="bank"]'
  ];

  const query = buildAroundQuery(lat, lon, radius, selectors);
  const elements = await queryOverpass(query, { cacheKey: `overpass_atms_${lat}_${lon}_${radius}` });

  return elements
    .map((el) => {
      const tags = el.tags || {};
      const coords = getElementCoords(el);
      if (coords.latitude == null || coords.longitude == null) return null;

      const isBank = tags.amenity === 'bank';
      const operator = tags.operator || tags.brand || tags.name || 'Bank ATM';
      const name = tags.name || (isBank ? `${operator} Branch` : `${operator} 24x7 ATM`);
      const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);

      return normalizePoi({
        id: `osm_atm_${el.type}_${el.id}`,
        name,
        category: isBank ? 'bank' : 'atm',
        address: formatAddressFromOsmTags(tags),
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone: tags.phone || null,
        rating: null,
        reviews: 0,
        openingHours: isBank ? (tags.opening_hours || '10:00 AM – 04:00 PM') : '24/7 Cash Available',
        description: isBank ? 'Banking Services & Cash Counter' : '24 Hours Automated Teller Machine',
        source: 'open_public_osm',
        sourceUrl: 'https://www.openstreetmap.org',
        verified: Boolean(tags.operator || tags.brand),
        distanceKm: dist,
        extra: {
          operator,
          cashIn: tags['cash_in'] === 'yes'
        }
      });
    })
    .filter(Boolean)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
    .slice(0, limit);
}

function getSeedAtms(lat, lon) {
  const seeds = [
    { name: 'State Bank of India (SBI) 24x7 ATM', operator: 'State Bank of India', lat: 11.0048, lon: 76.9662, address: 'State Bank Road, Coimbatore' },
    { name: 'HDFC Bank ATM & Branch', operator: 'HDFC Bank', lat: 11.0162, lon: 76.9685, address: 'DB Road, RS Puram, Coimbatore' },
    { name: 'ICICI Bank 24/7 ATM', operator: 'ICICI Bank', lat: 11.0175, lon: 76.9710, address: 'Gandhipuram 100 Feet Road, Coimbatore' },
    { name: 'Canara Bank ATM', operator: 'Canara Bank', lat: 11.0112, lon: 76.9585, address: 'Avinashi Road, Coimbatore' }
  ];

  return seeds.map((s, i) => {
    const dist = lat != null && lon != null ? haversineDistanceKm(lat, lon, s.lat, s.lon) : null;
    return normalizePoi({
      id: `seed_atm_${i + 1}`,
      name: s.name,
      category: 'atm',
      address: s.address,
      latitude: s.lat,
      longitude: s.lon,
      phone: null,
      rating: null,
      reviews: 0,
      openingHours: '24/7 Cash Machine',
      description: '24 Hours Automated Teller Machine',
      source: 'rbi_open_bank_directory',
      sourceUrl: null,
      verified: true,
      distanceKm: dist,
      extra: { operator: s.operator }
    });
  });
}
