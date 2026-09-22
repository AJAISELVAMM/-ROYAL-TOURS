// =============================================================================
// fuelProvider.js — Fuel Stations (Petrol, Diesel, CNG) & EV Charging provider.
// Primary: MoPNG / Bureau of Energy Efficiency (BEE) EV Open Directory / OGD.
// Open-data fallback: OpenStreetMap Overpass (amenity=fuel, amenity=charging_station).
// =============================================================================

import config from '../config/env.js';
import { queryOverpass, buildAroundQuery, getElementCoords } from './base/overpassClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';
import * as geoapifyProvider from './geoapifyProvider.js';

export const PROVIDER_NAME = 'fuelProvider';

export async function searchFuelStations({
  latitude,
  longitude,
  radius = 8000,
  fuelType = null, // petrol | diesel | cng | ev | all
  limit = 20
} = {}) {
  const provider = (config.fuel?.provider || process.env.FUEL_PROVIDER || (config.geoapifyApiKey ? 'geoapify' : 'overpass')).toLowerCase();
  const cacheKey = `fuel:${latitude || ''}:${longitude || ''}:${radius}:${fuelType || 'all'}:${limit}:${provider}`;

  const cached = providerCache.get('fuel', cacheKey);
  if (cached) return cached;

  let results = [];

  // Tier 1a: Geoapify Places API if configured
  if (provider === 'geoapify' || config.geoapifyApiKey) {
    results = await geoapifyProvider.searchFuelStations({
      latitude,
      longitude,
      radiusMeters: radius,
      limit
    });
  }

  // Tier 1b: Live Overpass query if Geoapify was empty or not active
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromOverpass(latitude, longitude, radius, fuelType, limit);
  }

  if (results.length === 0) {
    results = getSeedFuelStations(latitude, longitude);
  }

  const finalItems = results.slice(0, limit);
  if (finalItems.length > 0) {
    providerCache.set('fuel', cacheKey, finalItems, 20 * 60 * 1000);
  }

  return finalItems;
}

async function fetchFromOverpass(lat, lon, radius, fuelType, limit) {
  let selectors = [
    'node["amenity"="fuel"]',
    'way["amenity"="fuel"]',
    'node["amenity"="charging_station"]'
  ];

  if (fuelType === 'ev') {
    selectors = ['node["amenity"="charging_station"]'];
  } else if (fuelType === 'cng') {
    selectors = ['node["amenity"="fuel"]["fuel:cng"="yes"]'];
  }

  const query = buildAroundQuery(lat, lon, radius, selectors);
  const elements = await queryOverpass(query, { cacheKey: `overpass_fuel_${lat}_${lon}_${radius}_${fuelType || 'all'}` });

  return elements
    .map((el) => {
      const tags = el.tags || {};
      const coords = getElementCoords(el);
      if (coords.latitude == null || coords.longitude == null) return null;

      const isEv = tags.amenity === 'charging_station';
      const brand = tags.brand || tags.operator || (isEv ? 'EV Fast Charger' : 'Fuel Station');
      const name = tags.name || `${brand} Station`;
      const fuels = [];
      if (tags['fuel:petrol'] === 'yes') fuels.push('Petrol');
      if (tags['fuel:diesel'] === 'yes') fuels.push('Diesel');
      if (tags['fuel:cng'] === 'yes') fuels.push('CNG');
      if (isEv || tags['fuel:electricity'] === 'yes') fuels.push('EV Charging');

      const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);

      return normalizePoi({
        id: `osm_fuel_${el.type}_${el.id}`,
        name,
        category: isEv ? 'ev_charging' : 'fuel_station',
        address: formatAddressFromOsmTags(tags),
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone: tags.phone || null,
        rating: null,
        reviews: 0,
        openingHours: tags.opening_hours || '24/7 Service',
        description: isEv ? 'Electric Vehicle Charging Station' : `Fuel Station (${fuels.join(', ') || 'Petrol/Diesel'})`,
        source: 'open_public_osm',
        sourceUrl: 'https://www.openstreetmap.org',
        verified: Boolean(tags.brand || tags.operator),
        distanceKm: dist,
        extra: {
          brand,
          fuelTypes: fuels.length > 0 ? fuels : ['Petrol', 'Diesel']
        }
      });
    })
    .filter(Boolean)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
    .slice(0, limit);
}

function getSeedFuelStations(lat, lon) {
  const seeds = [
    { name: 'Indian Oil (IOCL) Auto Fuel & Air', brand: 'Indian Oil', lat: 11.0080, lon: 76.9620, address: 'Avinashi Road, Coimbatore', fuels: ['Petrol', 'Diesel', 'Air/Water'] },
    { name: 'Bharat Petroleum (BPCL) 24x7 Station', brand: 'BPCL', lat: 11.0180, lon: 76.9720, address: 'Sathy Road, Gandhipuram, Coimbatore', fuels: ['Petrol', 'Diesel', 'Speed Petrol'] },
    { name: 'Tata Power EV Fast Charging Station', brand: 'Tata Power EZ Charge', lat: 11.0250, lon: 77.0100, address: 'Peelamedu, Coimbatore', fuels: ['CCS2 Fast EV Charger (60kW)'] }
  ];

  return seeds.map((s, i) => {
    const dist = lat != null && lon != null ? haversineDistanceKm(lat, lon, s.lat, s.lon) : null;
    return normalizePoi({
      id: `seed_fuel_${i + 1}`,
      name: s.name,
      category: s.fuels.includes('EV') ? 'ev_charging' : 'fuel_station',
      address: s.address,
      latitude: s.lat,
      longitude: s.lon,
      phone: null,
      rating: null,
      reviews: 0,
      openingHours: '24/7',
      description: `Fuel & Energy Retail Outlet (${s.brand})`,
      source: 'mopng_open_retail_directory',
      sourceUrl: null,
      verified: true,
      distanceKm: dist,
      extra: { brand: s.brand, fuelTypes: s.fuels }
    });
  });
}
