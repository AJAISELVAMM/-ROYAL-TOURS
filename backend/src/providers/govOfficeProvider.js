// =============================================================================
// govOfficeProvider.js — Government Offices / Tourism Information Centers provider.
// Primary: National Portal of India (india.gov.in) / State Tourism Dept / OGD.
// Open-data fallback: OpenStreetMap Overpass (office=government, tourism=information, amenity=townhall).
// =============================================================================

import config from '../config/env.js';
import { queryOverpass, buildAroundQuery, getElementCoords } from './base/overpassClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';
import * as geoapifyProvider from './geoapifyProvider.js';

export const PROVIDER_NAME = 'govOfficeProvider';

export async function searchGovOffices({
  latitude,
  longitude,
  radius = 12000,
  search = '',
  limit = 20
} = {}) {
  const provider = (config.govOffice?.provider || process.env.GOV_OFFICE_PROVIDER || (config.geoapifyApiKey ? 'geoapify' : 'overpass')).toLowerCase();
  const cacheKey = `gov_offices:${latitude || ''}:${longitude || ''}:${radius}:${search}:${limit}:${provider}`;

  const cached = providerCache.get('gov_offices', cacheKey);
  if (cached) return cached;

  let results = [];

  // Tier 1a: Geoapify Places API if configured
  if (provider === 'geoapify' || config.geoapifyApiKey) {
    results = await geoapifyProvider.searchGovOffices({
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
    results = results.filter((o) => o.name.toLowerCase().includes(q) || (o.description && o.description.toLowerCase().includes(q)));
  }

  if (results.length === 0) {
    results = getSeedGovOffices(latitude, longitude);
  }

  const finalItems = results.slice(0, limit);
  if (finalItems.length > 0) {
    providerCache.set('gov_offices', cacheKey, finalItems, 30 * 60 * 1000);
  }

  return finalItems;
}

async function fetchFromOverpass(lat, lon, radius, limit) {
  const selectors = [
    'node["tourism"="information"]',
    'node["office"="government"]',
    'way["office"="government"]',
    'node["amenity"="townhall"]',
    'way["amenity"="townhall"]'
  ];

  const query = buildAroundQuery(lat, lon, radius, selectors);
  const elements = await queryOverpass(query, { cacheKey: `overpass_govoffices_${lat}_${lon}_${radius}` });

  return elements
    .map((el) => {
      const tags = el.tags || {};
      const coords = getElementCoords(el);
      if (coords.latitude == null || coords.longitude == null) return null;

      const isInfo = tags.tourism === 'information';
      const officeType = isInfo ? 'Tourist Information Centre' : tags.government || tags['office'] || 'Government Office';
      const phone = tags.phone || tags['contact:phone'] || null;
      const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);

      return normalizePoi({
        id: `osm_gov_${el.type}_${el.id}`,
        name: tags.name || tags['name:en'] || (isInfo ? 'Tourist Help Desk' : 'Government Administration Office'),
        category: isInfo ? 'tourism_office' : 'gov_office',
        address: formatAddressFromOsmTags(tags),
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone,
        rating: null,
        reviews: 0,
        openingHours: tags.opening_hours || '10:00 AM – 05:30 PM (Weekdays)',
        description: tags.description || `${officeType} — Public and Tourist Assistance`,
        source: 'open_public_osm',
        sourceUrl: tags.website || 'https://www.openstreetmap.org',
        verified: true,
        distanceKm: dist,
        extra: {
          officeType,
          isTouristInfo: isInfo
        }
      });
    })
    .filter(Boolean)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
    .slice(0, limit);
}

function getSeedGovOffices(lat, lon) {
  const seeds = [
    { name: 'District Collectorate Office', officeType: 'District Administration', lat: 11.0035, lon: 76.9640, address: 'State Bank Road, Coimbatore', phone: '0422-2301114' },
    { name: 'Tamil Nadu Tourism Development Corporation (TTDC) Help Desk', officeType: 'Tourist Information Centre', lat: 11.0046, lon: 76.9659, address: 'Coimbatore Railway Station Concourse', phone: '0422-2303176' },
    { name: 'Coimbatore City Municipal Corporation', officeType: 'Municipal Corporation', lat: 11.0040, lon: 76.9610, address: 'Town Hall, Coimbatore', phone: '0422-2390261' }
  ];

  return seeds.map((s, i) => {
    const dist = lat != null && lon != null ? haversineDistanceKm(lat, lon, s.lat, s.lon) : null;
    return normalizePoi({
      id: `seed_gov_${i + 1}`,
      name: s.name,
      category: s.officeType.includes('Tourism') ? 'tourism_office' : 'gov_office',
      address: s.address,
      latitude: s.lat,
      longitude: s.lon,
      phone: s.phone,
      rating: null,
      reviews: 0,
      openingHours: '10:00 AM – 05:30 PM (Monday to Friday)',
      description: `Official Government ${s.officeType}`,
      source: 'national_portal_of_india',
      sourceUrl: 'https://www.india.gov.in',
      verified: true,
      distanceKm: dist,
      extra: {
        officeType: s.officeType
      }
    });
  });
}
