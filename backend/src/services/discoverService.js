// =============================================================================
// discoverService.js — Real GPS-driven Catalog and POI Discovery Service.
// Integrates OpenStreetMap/Overpass live datasets with database support.
// =============================================================================

import prisma from '../config/database.js';
import { notFound } from '../utils/errors.js';
import { searchByCategory, geocodingProvider } from '../providers/index.js';
import { haversineDistanceKm } from '../providers/base/normalizer.js';
import providerCache from '../providers/base/cache.js';

const MODELS = {
  places: prisma.place,
  hotels: prisma.hotel,
  restaurants: prisma.restaurant,
  theatres: prisma.theatre,
  shopping: prisma.shopping
};

const SEARCH_FIELDS = {
  places: ['name', 'category', 'location'],
  hotels: ['name', 'location'],
  restaurants: ['name', 'cuisine', 'location'],
  theatres: ['name', 'location'],
  shopping: ['name', 'category', 'location']
};

const EXTENDED_PROVIDER_TYPES = [
  'hospitals',
  'police',
  'emergency',
  'transport',
  'transit_hubs',
  'atms',
  'pharmacies',
  'fuel',
  'gov_offices',
  'facilities'
];

export async function listCollection(type, query = {}) {
  const normType = String(type || '').toLowerCase();
  let qLat = query.latitude != null ? Number(query.latitude) : query.lat != null ? Number(query.lat) : null;
  let qLon = query.longitude != null ? Number(query.longitude) : query.lon != null ? Number(query.lon) : null;
  const limit = Number(query.limit) || 50;
  const page = Math.max(Number(query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const destination = query.destination || '';
  const search = query.search || '';
  const category = query.category || null;
  // Use 60km (60,000 meters) as standard discover radius; convert km if passed <= 100
  let radius = 60000;
  if (query.radius) {
    const rawR = Number(query.radius);
    radius = rawR <= 100 ? rawR * 1000 : rawR;
  }
  const radiusKm = Math.min(65, Math.round(radius / 1000) || 60);
  const latDelta = (radiusKm / 111) * 1.05;
  const lonDelta = (radiusKm / (111 * Math.max(0.1, Math.cos(Number(qLat || 11) * Math.PI / 180)))) * 1.05;

  // If destination provided without coordinates, resolve destination coordinates
  if ((qLat == null || qLon == null) && destination.trim()) {
    try {
      const geo = await geocodingProvider.geocode(destination.trim());
      if (geo && geo.lat != null && geo.lon != null) {
        qLat = Number(geo.lat);
        qLon = Number(geo.lon);
      }
    } catch (err) {
      console.warn(`[discoverService] Geocode for destination failed: ${err.message}`);
    }
  }

  // Extended types (hospitals, police, pharmacies, etc.) handled directly by providers
  if (EXTENDED_PROVIDER_TYPES.includes(normType)) {
    if (qLat == null || qLon == null) {
      return { items: [], total: 0, page: Number(query.page) || 1, limit };
    }
    const items = await searchByCategory(normType, {
      latitude: qLat,
      longitude: qLon,
      radius,
      search,
      limit
    });
    return { items, total: items.length, page: Number(query.page) || 1, limit };
  }

  const model = MODELS[normType];
  if (!model) throw notFound(`Unknown catalog type: ${type}`);

  // Without coordinates (e.g. unlocated unit tests or raw catalog queries), fall back to DB catalog
  if (qLat == null || qLon == null) {
    const where = {};
    if (search) {
      where.OR = SEARCH_FIELDS[normType].map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }));
    }
    if (category) where.category = category;
    const [dbItems, total] = await Promise.all([
      model.findMany({ where, skip: offset, take: limit }),
      model.count({ where })
    ]);
    return { items: dbItems, total, page: Number(query.page) || 1, limit };
  }

  // Tier 1: Query live category providers (Overpass + Nominatim fallback)
  try {
    const keywordSearch = (query.latitude != null && query.longitude != null) ? search : '';
    const liveItems = await searchByCategory(normType, {
      latitude: qLat,
      longitude: qLon,
      radius,
      search: keywordSearch,
      category,
      rating: query.rating ? Number(query.rating) : undefined,
      limit
    });

    if (liveItems && liveItems.length > 0) {
      const seenKeys = new Set();
      const validLive = [];

      for (const it of liveItems) {
        if (it.latitude == null || it.longitude == null) continue;
        const dist = haversineDistanceKm(qLat, qLon, it.latitude, it.longitude);
        if (dist == null || dist > radiusKm) continue;

        it.distanceKm = Math.round(dist * 10) / 10;
        const key = it.id || `${it.name.toLowerCase().trim()}_${it.latitude.toFixed(3)}_${it.longitude.toFixed(3)}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          validLive.push(it);
        }
      }

      if (validLive.length > 0) {
        // Sort strictly nearest first
        validLive.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
        validLive.forEach((it) => {
          if (it?.id) providerCache.set('poi_item', it.id, it);
        });
        return { items: validLive.slice(0, limit), total: validLive.length, page: Number(query.page) || 1, limit };
      }
    }
  } catch (err) {
    console.warn(`[discoverService] Live query failed for ${normType}: ${err.message}. Checking DB within ${radiusKm}km...`);
  }

  // Tier 2: Database fallback strictly within configured radius (60km)
  const where = {
    latitude: { gte: qLat - latDelta, lte: qLat + latDelta },
    longitude: { gte: qLon - lonDelta, lte: qLon + lonDelta }
  };
  if (search) {
    where.OR = SEARCH_FIELDS[normType].map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }));
  }
  if (category) where.category = category;
  if (query.rating) where.rating = { gte: Number(query.rating) };

  try {
    let [dbItems, total] = await Promise.all([
      model.findMany({
        where,
        skip: (Number(query.page || 1) - 1) * limit,
        take: limit * 2,
        orderBy: { rating: 'desc' }
      }),
      model.count({ where })
    ]);

    // If shopping table has few/no local items, pull real Shopping & Markets records from places table
    if (normType === 'shopping' && dbItems.length < 5) {
      const placeWhere = {
        category: { contains: 'Shopping', mode: 'insensitive' },
        latitude: { gte: qLat - latDelta, lte: qLat + latDelta },
        longitude: { gte: qLon - lonDelta, lte: qLon + lonDelta }
      };
      const extraPlaces = await prisma.place.findMany({
        where: placeWhere,
        take: limit - dbItems.length,
        orderBy: { rating: 'desc' }
      });
      dbItems = [...dbItems, ...extraPlaces];
    }

    // Recalculate authentic distance and enforce radius
    const seenDb = new Set();
    const items = [];
    for (const it of dbItems) {
      if (it.latitude == null || it.longitude == null) continue;
      const dist = haversineDistanceKm(qLat, qLon, it.latitude, it.longitude);
      if (dist == null || dist > radiusKm) continue;

      const normItem = {
        ...it,
        distanceKm: Math.round(dist * 10) / 10
      };
      const key = normItem.id || normItem.name.toLowerCase().trim();
      if (!seenDb.has(key)) {
        seenDb.add(key);
        items.push(normItem);
      }
      if (normItem.id) providerCache.set('poi_item', normItem.id, normItem);
    }

    items.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

    return { items: items.slice(0, limit), total: items.length, page: Number(query.page) || 1, limit };
  } catch (err) {
    console.warn(`[discoverService] DB query failed for ${normType}: ${err.message}`);
    return { items: [], total: 0, page: Number(query.page) || 1, limit };
  }
}

export async function getItem(type, id) {
  if (!id) throw notFound('Item ID is required.');
  const normType = String(type || '').toLowerCase();

  // 1. Check in-memory item cache first
  const cached = providerCache.get('poi_item', id);
  if (cached) return cached;

  // 2. Check Database for matching model
  const model = MODELS[normType] || MODELS[`${normType}s`];
  if (model) {
    try {
      const item = await model.findUnique({ where: { id } });
      if (item) {
        providerCache.set('poi_item', id, item);
        return item;
      }
    } catch {
      // Continue search
    }
  }

  // 3. Check other models in case of category alias
  for (const [key, m] of Object.entries(MODELS)) {
    if (key !== normType) {
      try {
        const item = await m.findUnique({ where: { id } });
        if (item) {
          providerCache.set('poi_item', id, item);
          return item;
        }
      } catch {
        // continue
      }
    }
  }

  // 4. Try resolving through live collection query
  try {
    const list = await listCollection(normType, { limit: 100 });
    const match = (list.items || []).find((i) => i.id === id);
    if (match) {
      providerCache.set('poi_item', id, match);
      return match;
    }
  } catch {
    // continue
  }

  throw notFound(`Item not found for ID: ${id}`);
}

export async function getTheatreShows(theatreId) {
  try {
    const theatre = await prisma.theatre.findUnique({ where: { id: theatreId } });
    if (!theatre) throw notFound('Theatre not found.');
    const shows = await prisma.theatreShow.findMany({ where: { theatreId } });
    return {
      theatre,
      shows,
      liveShowtimesAvailable: shows.length > 0,
      message: shows.length > 0 ? null : 'Live showtimes are currently unavailable.'
    };
  } catch (err) {
    if (err.statusCode === 404) throw err;
    return {
      theatre: { id: theatreId, name: 'Cinema Theatre' },
      shows: [],
      liveShowtimesAvailable: false,
      message: 'Live showtimes are currently unavailable.'
    };
  }
}
