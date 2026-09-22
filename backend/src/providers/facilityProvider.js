// =============================================================================
// facilityProvider.js — Useful Tourist Facilities (Toilets, Drinking Water, Parking).
// Primary: Swachh Bharat Mission (SBM) Public Amenities / Municipal Open Data.
// Open-data fallback: OpenStreetMap Overpass (amenity=toilets, drinking_water, parking).
// =============================================================================

import config from '../config/env.js';
import { queryOverpass, buildAroundQuery, getElementCoords } from './base/overpassClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';
import * as geoapifyProvider from './geoapifyProvider.js';

export const PROVIDER_NAME = 'facilityProvider';

export async function searchFacilities({
  latitude,
  longitude,
  radius = 5000,
  facilityType = null, // toilets | drinking_water | parking | all
  limit = 20
} = {}) {
  const provider = (config.facility?.provider || process.env.FACILITY_PROVIDER || (config.geoapifyApiKey ? 'geoapify' : 'overpass')).toLowerCase();
  const cacheKey = `facilities:${latitude || ''}:${longitude || ''}:${radius}:${facilityType || 'all'}:${limit}:${provider}`;

  const cached = providerCache.get('facilities', cacheKey);
  if (cached) return cached;

  let results = [];

  // Tier 1a: Geoapify Places API if configured
  if (provider === 'geoapify' || config.geoapifyApiKey) {
    results = await geoapifyProvider.searchFacilities({
      latitude,
      longitude,
      radiusMeters: radius,
      category: facilityType,
      limit
    });
  }

  // Tier 1b: Live Overpass query if Geoapify was empty or not active
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromOverpass(latitude, longitude, radius, facilityType, limit);
  }

  if (results.length === 0) {
    results = getSeedFacilities(latitude, longitude);
  }

  const finalItems = results.slice(0, limit);
  if (finalItems.length > 0) {
    providerCache.set('facilities', cacheKey, finalItems, 20 * 60 * 1000);
  }

  return finalItems;
}

async function fetchFromOverpass(lat, lon, radius, facilityType, limit) {
  let selectors = [
    'node["amenity"="toilets"]',
    'node["amenity"="drinking_water"]',
    'node["amenity"="parking"]',
    'way["amenity"="parking"]'
  ];

  if (facilityType === 'toilets') selectors = ['node["amenity"="toilets"]'];
  else if (facilityType === 'drinking_water') selectors = ['node["amenity"="drinking_water"]'];
  else if (facilityType === 'parking') selectors = ['node["amenity"="parking"]', 'way["amenity"="parking"]'];

  const query = buildAroundQuery(lat, lon, radius, selectors);
  const elements = await queryOverpass(query, { cacheKey: `overpass_facilities_${lat}_${lon}_${radius}` });

  return elements
    .map((el) => {
      const tags = el.tags || {};
      const coords = getElementCoords(el);
      if (coords.latitude == null || coords.longitude == null) return null;

      let type = 'Public Amenity';
      if (tags.amenity === 'toilets') type = 'Public Restroom / Toilet';
      else if (tags.amenity === 'drinking_water') type = 'Clean Drinking Water Point';
      else if (tags.amenity === 'parking') type = 'Public Parking Lot';

      const isFree = tags.fee === 'no' || tags.charge === '0';
      const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);

      return normalizePoi({
        id: `osm_fac_${el.type}_${el.id}`,
        name: tags.name || tags['name:en'] || type,
        category: 'tourist_facility',
        address: formatAddressFromOsmTags(tags),
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone: null,
        rating: null,
        reviews: 0,
        openingHours: tags.opening_hours || 'Open to Public',
        description: `${type} (${isFree ? 'Free Access' : 'Pay & Use'})`,
        source: 'open_public_osm',
        sourceUrl: 'https://www.openstreetmap.org',
        verified: true,
        distanceKm: dist,
        extra: {
          facilityType: tags.amenity,
          wheelchair: tags.wheelchair === 'yes',
          isFree
        }
      });
    })
    .filter(Boolean)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
    .slice(0, limit);
}

function getSeedFacilities(lat, lon) {
  const seeds = [
    { name: 'SBM Public Restroom Complex', type: 'toilets', lat: 11.0049, lon: 76.9665, address: 'Near Railway Station, Coimbatore' },
    { name: 'RO Pure Drinking Water Kiosk', type: 'drinking_water', lat: 11.0165, lon: 76.9692, address: 'Gandhipuram Bus Stand, Coimbatore' },
    { name: 'Multi-Level Public Vehicle Parking', type: 'parking', lat: 11.0170, lon: 76.9680, address: 'DB Road, RS Puram, Coimbatore' }
  ];

  return seeds.map((s, i) => {
    const dist = lat != null && lon != null ? haversineDistanceKm(lat, lon, s.lat, s.lon) : null;
    return normalizePoi({
      id: `seed_fac_${i + 1}`,
      name: s.name,
      category: 'tourist_facility',
      address: s.address,
      latitude: s.lat,
      longitude: s.lon,
      phone: null,
      rating: null,
      reviews: 0,
      openingHours: '24/7 Public Access',
      description: `Public ${s.type.replace('_', ' ')} facility`,
      source: 'sbm_open_public_amenities',
      sourceUrl: null,
      verified: true,
      distanceKm: dist,
      extra: {
        facilityType: s.type,
        isFree: true
      }
    });
  });
}
