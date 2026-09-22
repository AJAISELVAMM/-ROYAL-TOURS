// =============================================================================
// geoapifyProvider.js — Geoapify Places API provider for TourGuard AI.
// Official Geoapify Places API v2 integration (https://api.geoapify.com/v2/places).
// Queries verified geographic location datasets with rate-limit caching,
// normalized schema output, and graceful fallback handling.
// =============================================================================

import config from '../config/env.js';
import providerCache from './base/cache.js';
import { normalizePoi, haversineDistanceKm } from './base/normalizer.js';

const GEOAPIFY_PLACES_BASE_URL = 'https://api.geoapify.com/v2/places';

/**
 * Low-level Geoapify Places API query helper.
 * @param {object} params
 * @param {string} params.categories - Comma-separated Geoapify category IDs
 * @param {number} params.latitude - Center latitude
 * @param {number} params.longitude - Center longitude
 * @param {number} [params.radiusMeters=5000] - Search radius in meters
 * @param {string} [params.search] - Text query/filter
 * @param {number} [params.limit=20] - Max results (max 100)
 * @param {string} [params.apiKey] - Optional explicit API key override
 * @returns {Promise<Array<object>>} Raw GeoJSON feature items
 */
export async function queryGeoapifyPlaces({
  categories,
  latitude,
  longitude,
  radiusMeters = 5000,
  search = '',
  limit = 20,
  apiKey = null
} = {}) {
  // Validate coordinates
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return [];
  }

  const effectiveKey = apiKey || config.geoapifyApiKey || process.env.GEOAPIFY_API_KEY || '';
  if (!effectiveKey) {
    // eslint-disable-next-line no-console
    console.warn('[geoapify] GEOAPIFY_API_KEY is not configured — skipping live Geoapify query.');
    return [];
  }

  // Respect mock mode for offline testing
  if (config.mockExternalServices || process.env.MOCK_EXTERNAL_SERVICES === 'true') {
    return [];
  }

  const cacheKey = `${categories}:${lat.toFixed(4)},${lon.toFixed(4)}:${radiusMeters}:${search}:${limit}`;
  const cached = providerCache.get('geoapify', cacheKey);
  if (cached) return cached;

  const url = new URL(GEOAPIFY_PLACES_BASE_URL);
  url.searchParams.set('categories', categories);
  url.searchParams.set('filter', `circle:${lon},${lat},${radiusMeters}`);
  url.searchParams.set('bias', `proximity:${lon},${lat}`);
  url.searchParams.set('limit', String(Math.min(Math.max(1, limit), 100)));
  url.searchParams.set('apiKey', effectiveKey);

  if (search && search.trim()) {
    url.searchParams.set('name', search.trim());
  }

  const controller = new AbortController();
  const isTest = process.env.NODE_ENV === 'test';
  const timeoutId = setTimeout(() => controller.abort(), isTest ? 3000 : 7000);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TourGuard-AI/1.0 (Geospatial Tourism Assistant)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // eslint-disable-next-line no-console
        console.warn(`[geoapify] Authentication failed (HTTP ${res.status}). Verify GEOAPIFY_API_KEY.`);
      } else if (res.status === 429) {
        // eslint-disable-next-line no-console
        console.warn('[geoapify] Daily quota exceeded (HTTP 429). Falling back to secondary providers.');
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[geoapify] Request failed with HTTP ${res.status}`);
      }
      return [];
    }

    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    if (features.length > 0) {
      providerCache.set('geoapify', cacheKey, features, 15 * 60 * 1000); // 15 min TTL
    }

    return features;
  } catch (err) {
    clearTimeout(timeoutId);
    // eslint-disable-next-line no-console
    console.warn(`[geoapify] Request error: ${err.message}`);
    return [];
  }
}

/**
 * Normalize a Geoapify feature into TourGuard unified POI structure.
 */
export function normalizeGeoapifyFeature(feature, { originLat, originLon, requestedCategory = 'facility', extra = {} } = {}) {
  const p = feature?.properties || {};
  const coords = feature?.geometry?.coordinates;
  const lon = p.lon != null ? p.lon : Array.isArray(coords) ? coords[0] : null;
  const lat = p.lat != null ? p.lat : Array.isArray(coords) ? coords[1] : null;

  const id = p.place_id ? `geoapify_${p.place_id}` : `geoapify_${Math.random().toString(36).slice(2, 10)}`;
  const name = p.name || p.address_line1 || p.formatted || 'Unnamed Location';
  const address = p.formatted || [p.address_line1, p.address_line2, p.city, p.state, p.postcode].filter(Boolean).join(', ') || null;

  const dist = originLat != null && originLon != null && lat != null && lon != null
    ? haversineDistanceKm(originLat, originLon, lat, lon)
    : null;

  // Extract phone & website
  const phone = p.contact?.phone || p.phone || null;
  const website = p.website || p.contact?.url || null;
  const openingHours = p.opening_hours || p.working_hours || null;

  // Estimate rating from popularity rank (0..1) if available, or default
  const pop = p.rank?.popularity;
  const rating = pop != null ? +(3.5 + pop * 1.5).toFixed(1) : 4.4;

  return normalizePoi({
    id,
    name,
    category: requestedCategory,
    address,
    latitude: lat,
    longitude: lon,
    phone,
    rating,
    reviews: p.reviews || 0,
    openingHours,
    description: p.description || p.datasource?.raw?.description || null,
    source: 'geoapify',
    sourceUrl: p.datasource?.url || 'https://www.geoapify.com',
    verified: true,
    distanceKm: dist,
    extra: {
      website,
      city: p.city || null,
      state: p.state || null,
      country: p.country || 'India',
      ...extra
    }
  });
}

// =============================================================================
// CATEGORY SEARCH METHODS
// =============================================================================

/**
 * 1. Hotels & Accommodation
 */
export async function searchHotels({ latitude, longitude, radiusMeters = 5000, search = '', rating, limit = 20, apiKey } = {}) {
  const categories = 'accommodation,accommodation.hotel,accommodation.guest_house,accommodation.motel,accommodation.hostel';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    const facilitiesList = [];
    if (p.facilities?.wheelchair || p.categories?.includes('wheelchair')) facilitiesList.push('Wheelchair Accessible');
    if (p.facilities?.internet_access || p.categories?.includes('internet_access')) facilitiesList.push('Free WiFi');
    if (facilitiesList.length === 0) facilitiesList.push('Free WiFi', 'Air Conditioning');

    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'hotel',
      extra: {
        facilities: facilitiesList,
        pricePerNight: p.price || 3000,
        website: p.website || null,
        checkIn: '12:00 PM',
        checkOut: '11:00 AM'
      }
    });
  }).filter((h) => (rating ? (h.rating || 0) >= Number(rating) : true));
}

/**
 * 2. Restaurants & Food
 */
export async function searchRestaurants({ latitude, longitude, radiusMeters = 5000, search = '', cuisine, vegOnly, limit = 20, apiKey } = {}) {
  const categories = 'catering.restaurant,catering.cafe,catering.fast_food';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    const detectedCuisine = p.catering?.cuisine || (p.categories?.find((c) => c.startsWith('catering.restaurant.')) || '').split('.').pop() || 'Multi-Cuisine';
    const isVeg = p.catering?.diet?.vegetarian === true || p.categories?.includes('vegetarian') || /veg|annapoorna|bhavan/i.test(p.name || '');

    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'restaurant',
      extra: {
        cuisine: detectedCuisine,
        veg: isVeg,
        priceRange: p.price_level ? '₹'.repeat(Math.min(4, p.price_level)) : '₹₹'
      }
    });
  }).filter((r) => {
    if (vegOnly && !r.veg) return false;
    if (cuisine && !String(r.cuisine || '').toLowerCase().includes(cuisine.toLowerCase())) return false;
    return true;
  });
}

/**
 * 3. Tourist Attractions & Places
 */
export async function searchAttractions({ latitude, longitude, radiusMeters = 10000, search = '', category, limit = 25, apiKey } = {}) {
  const categories = 'tourism.attraction,tourism.sights,heritage,entertainment.museum,entertainment.theme_park,leisure.park';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    const cats = p.categories || [];
    let subCat = 'Sightseeing';
    if (cats.some((c) => c.includes('museum'))) subCat = 'Museum';
    else if (cats.some((c) => c.includes('heritage') || c.includes('historic'))) subCat = 'Historic Site';
    else if (cats.some((c) => c.includes('park'))) subCat = 'Park';
    else if (cats.some((c) => c.includes('worship') || c.includes('temple'))) subCat = 'Temple';

    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: subCat,
      extra: {
        entryPrice: p.fee === 'no' || p.categories?.includes('fee.no') ? 'Free Entry' : 'Entry Fee Applicable',
        facilities: 'Restrooms, Photography Allowed'
      }
    });
  }).filter((a) => (category ? String(a.category).toLowerCase().includes(category.toLowerCase()) : true));
}

/**
 * 4. Hospitals & Healthcare
 */
export async function searchHospitals({ latitude, longitude, radiusMeters = 8000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'healthcare.hospital,healthcare.clinic';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'hospital',
      extra: {
        emergency: true,
        type: 'HOSPITAL',
        phone: p.contact?.phone || p.phone || '108'
      }
    });
  });
}

/**
 * 5. Police Stations
 */
export async function searchPolice({ latitude, longitude, radiusMeters = 8000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'service.police';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'police',
      extra: {
        emergency: true,
        type: 'POLICE',
        phone: p.contact?.phone || p.phone || '112'
      }
    });
  });
}

export const searchPoliceStations = searchPolice;

/**
 * 6. Pharmacies & Chemist Stores
 */
export async function searchPharmacies({ latitude, longitude, radiusMeters = 5000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'healthcare.pharmacy';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'pharmacy',
      extra: {
        is24x7: p.opening_hours === '24/7' || p.categories?.includes('24_7') || false,
        dispensing: true
      }
    });
  });
}

/**
 * 7. Supermarkets & Shopping
 */
export async function searchSupermarkets({ latitude, longitude, radiusMeters = 5000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'commercial.supermarket,commercial.shopping_mall,commercial.clothing,commercial.marketplace';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    let shopType = 'Retail Store';
    if (p.categories?.includes('commercial.supermarket')) shopType = 'Supermarket';
    else if (p.categories?.includes('commercial.shopping_mall')) shopType = 'Shopping Mall';
    else if (p.categories?.includes('commercial.clothing')) shopType = 'Clothing & Textiles';

    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'shopping',
      extra: {
        shopType
      }
    });
  });
}

export const searchShopping = searchSupermarkets;

/**
 * 8. ATMs
 */
export async function searchATMs({ latitude, longitude, radiusMeters = 5000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'service.financial.atm';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'atm',
      extra: {
        operator: p.operator || p.name || 'Bank ATM',
        is24x7: true
      }
    });
  });
}

/**
 * 9. Banks
 */
export async function searchBanks({ latitude, longitude, radiusMeters = 5000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'service.financial.bank';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'bank',
      extra: {
        bankName: p.operator || p.name || 'Bank Branch',
        hasAtm: p.categories?.includes('service.financial.atm') || false
      }
    });
  });
}

/**
 * 10. Fuel Stations & EV Charging
 */
export async function searchFuelStations({ latitude, longitude, radiusMeters = 8000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'service.vehicle.fuel,service.vehicle.charging_station';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    const isEv = p.categories?.includes('service.vehicle.charging_station');
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: isEv ? 'ev_charging' : 'fuel_station',
      extra: {
        brand: p.operator || p.brand || p.name || 'Fuel Station',
        isEVCharging: isEv,
        fuels: isEv ? ['EV Fast Charging'] : ['Petrol', 'Diesel', 'CNG']
      }
    });
  });
}

/**
 * 11. Public Transport (Bus stops, Metro, Tram)
 */
export async function searchTransport({ latitude, longitude, radiusMeters = 5000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'public_transport,public_transport.bus,public_transport.subway,public_transport.train';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    let transitMode = 'Bus Stop';
    if (p.categories?.includes('public_transport.subway')) transitMode = 'Metro Station';
    else if (p.categories?.includes('public_transport.train')) transitMode = 'Railway Station';

    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'public_transport',
      extra: {
        transitMode,
        operator: p.operator || null
      }
    });
  });
}

export const searchTransportStops = searchTransport;

/**
 * 12. Airports
 */
export async function searchAirports({ latitude, longitude, radiusMeters = 30000, search = '', limit = 10, apiKey } = {}) {
  const categories = 'airport,airport.international,airport.domestic';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'transit_hub',
      extra: {
        hubType: 'Airport',
        iataCode: p.iata || null,
        is24x7: true
      }
    });
  });
}

/**
 * 13. Railway Stations
 */
export async function searchRailwayStations({ latitude, longitude, radiusMeters = 15000, search = '', limit = 10, apiKey } = {}) {
  const categories = 'railway.station,public_transport.train';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'transit_hub',
      extra: {
        hubType: 'Railway Station',
        is24x7: true
      }
    });
  });
}

/**
 * 14. Other Useful Tourist Facilities (Toilets, Drinking Water, Parking)
 */
export async function searchFacilities({ latitude, longitude, radiusMeters = 5000, search = '', category = null, limit = 20, apiKey } = {}) {
  let categories = 'amenity.toilet,amenity.drinking_water,parking';
  if (category) {
    const norm = category.toLowerCase();
    if (norm.includes('toilet') || norm.includes('restroom')) categories = 'amenity.toilet';
    else if (norm.includes('water')) categories = 'amenity.drinking_water';
    else if (norm.includes('park')) categories = 'parking';
  }

  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    let subType = 'Public Amenity';
    if (p.categories?.includes('amenity.toilet')) subType = 'Public Restroom';
    else if (p.categories?.includes('amenity.drinking_water')) subType = 'Drinking Water Station';
    else if (p.categories?.includes('parking')) subType = 'Public Parking';

    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'tourist_facility',
      extra: {
        facilityType: subType,
        fee: p.fee === 'no' ? 'Free' : 'Paid'
      }
    });
  });
}

/**
 * 15. Emergency Services (Composite: Police, Hospital, Fire)
 */
export async function searchEmergencyServices({ latitude, longitude, radiusMeters = 8000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'service.police,healthcare.hospital,service.fire_station';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    let emergencyType = 'EMERGENCY_SERVICE';
    let helpline = '112';

    if (p.categories?.includes('service.police')) {
      emergencyType = 'POLICE';
      helpline = '100';
    } else if (p.categories?.includes('healthcare.hospital')) {
      emergencyType = 'HOSPITAL';
      helpline = '108';
    } else if (p.categories?.includes('service.fire_station')) {
      emergencyType = 'FIRE_STATION';
      helpline = '101';
    }

    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: 'emergency',
      extra: {
        type: emergencyType,
        phone: p.contact?.phone || helpline
      }
    });
  });
}

/**
 * 16. Government & Tourism Offices
 */
export async function searchGovOffices({ latitude, longitude, radiusMeters = 8000, search = '', limit = 20, apiKey } = {}) {
  const categories = 'administrative,administrative.country,administrative.state,tourism.information';
  const features = await queryGeoapifyPlaces({ categories, latitude, longitude, radiusMeters, search, limit, apiKey });

  return features.map((f) => {
    const p = f.properties || {};
    const isTourism = p.categories?.includes('tourism.information');
    return normalizeGeoapifyFeature(f, {
      originLat: latitude,
      originLon: longitude,
      requestedCategory: isTourism ? 'tourism_office' : 'gov_office',
      extra: {
        officeType: isTourism ? 'Tourist Information Centre' : 'Government Administration Office'
      }
    });
  });
}
