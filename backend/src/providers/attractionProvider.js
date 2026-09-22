// =============================================================================
// attractionProvider.js — Tourist Attraction / Sightseeing places provider.
// Uses OpenStreetMap Overpass (node+way+relation) with 60km radius.
// No mock data. No fake ratings. Haversine distance filtering.
// =============================================================================

import prisma from '../config/database.js';
import { queryOverpass, buildUnionQuery, getElementCoords } from './base/overpassClient.js';
import { queryNominatimPois } from './base/nominatimClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';

export const PROVIDER_NAME = 'attractionProvider';

const DEFAULT_RADIUS = 60000; // 60 km
const DISTANCE_LIMIT_KM = 65; // Approximately 60 km with border tolerance

export async function searchAttractions({
  latitude,
  longitude,
  radius = DEFAULT_RADIUS,
  search = '',
  category = null,
  limit = 50
} = {}) {
  const effectiveRadius = Math.min(Number(radius) || DEFAULT_RADIUS, DEFAULT_RADIUS);
  const latStr = latitude != null ? Number(latitude).toFixed(3) : '';
  const lonStr = longitude != null ? Number(longitude).toFixed(3) : '';
  const cacheKey = `attractions_v5:${latStr}:${lonStr}:${effectiveRadius}:${category || 'all'}`;

  const cached = providerCache.get('attractions', cacheKey);
  if (cached) {
    let results = cached;
    if (search) results = filterBySearch(results, search);
    if (category && category !== 'All') results = results.filter((p) => matchesCategory(p, category));
    return results.slice(0, limit);
  }

  let results = [];

  // Query live Overpass and real database places
  if (latitude != null && longitude != null) {
    const [overpassSettled, dbSettled] = await Promise.allSettled([
      fetchFromOverpass(latitude, longitude, effectiveRadius),
      fetchFromDatabase({ latitude, longitude, limit: 100 })
    ]);

    let livePlaces = overpassSettled.status === 'fulfilled' && Array.isArray(overpassSettled.value)
      ? overpassSettled.value
      : [];
    const dbPlaces = dbSettled.status === 'fulfilled' && Array.isArray(dbSettled.value)
      ? dbSettled.value
      : [];

    // If Overpass yielded 0 results, query live Nominatim POIs as live OSM fallback
    if (livePlaces.length === 0) {
      try {
        const nomPlaces = await queryNominatimPois({
          latitude,
          longitude,
          radiusMeters: effectiveRadius,
          keywords: ['attraction', 'monument', 'temple', 'viewpoint', 'museum'],
          limit: 30,
          category: 'Sightseeing'
        });
        if (nomPlaces && nomPlaces.length > 0) {
          livePlaces = nomPlaces;
        }
      } catch (nomErr) {
        console.warn(`[attractionProvider] Nominatim fallback error: ${nomErr.message}`);
      }
    }

    results = [...livePlaces];
    const seenNames = new Set(results.map((r) => r.name.toLowerCase().trim()));
    for (const p of dbPlaces) {
      const normName = p.name.toLowerCase().trim();
      if (!seenNames.has(normName)) {
        seenNames.add(normName);
        results.push(p);
      }
    }
  }

  // Strictly enforce 60 km radius: discard any location > 60 km from destination
  results = results.filter((p) => {
    if (latitude != null && longitude != null && p.latitude != null && p.longitude != null) {
      const dist = haversineDistanceKm(latitude, longitude, p.latitude, p.longitude);
      if (dist != null) {
        p.distanceKm = Math.round(dist * 10) / 10;
        return dist <= DISTANCE_LIMIT_KM;
      }
    }
    return p.distanceKm == null || p.distanceKm <= DISTANCE_LIMIT_KM;
  });

  // Sort by distance from destination (closest first)
  results.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

  // Cache raw results (before search/category filter) for reuse
  if (results.length > 0) {
    providerCache.set('attractions', cacheKey, results, 20 * 60 * 1000);
  }

  // Apply search and category filters
  if (search) results = filterBySearch(results, search);
  if (category && category !== 'All') results = results.filter((p) => matchesCategory(p, category));

  return results.slice(0, limit);
}

function filterBySearch(items, search) {
  const q = search.toLowerCase();
  return items.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
  );
}

function matchesCategory(item, targetCategory) {
  if (!targetCategory || targetCategory.toLowerCase() === 'all') return true;
  const target = targetCategory.toLowerCase().trim();
  const cat = (item.category || '').toLowerCase();
  const sub = (item.subCategory || item.extra?.subCategory || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();

  const isTemple = cat.includes('temple') || cat.includes('shrine') || cat.includes('worship') || sub.includes('temple') || name.includes('temple') || name.includes('kovil') || name.includes('mandir') || name.includes('koil') || name.includes('mosque') || name.includes('church');
  const isMuseum = cat.includes('museum') || sub.includes('museum') || name.includes('museum') || name.includes('gallery');
  const isPark = cat.includes('park') || cat.includes('garden') || cat.includes('nature') || sub.includes('park') || name.includes('park') || name.includes('garden') || name.includes('sanctuary') || name.includes('lake') || name.includes('falls') || name.includes('forest') || name.includes('botanical');
  const isViewpoint = cat.includes('viewpoint') || sub.includes('viewpoint') || name.includes('viewpoint') || name.includes('view point') || name.includes('peak') || name.includes('hill') || name.includes('dam');
  const isHistorical = cat.includes('historic') || cat.includes('monument') || cat.includes('fort') || cat.includes('palace') || cat.includes('heritage') || sub.includes('historic') || name.includes('fort') || name.includes('palace') || name.includes('monument') || name.includes('tomb') || name.includes('mahal');

  if (target === 'museums' || target === 'museum') return isMuseum && !isTemple;
  if (target === 'temples' || target === 'temple') return isTemple && !isMuseum && !isPark;
  if (target === 'parks' || target === 'park') return isPark && !isTemple && !isMuseum;
  if (target === 'viewpoints' || target === 'viewpoint') return isViewpoint && !isMuseum && !isTemple;
  if (target === 'historical' || target === 'monument' || target === 'history') return isHistorical && !isTemple;
  if (target === 'attractions' || target === 'attraction') return !isTemple && !isMuseum;

  return cat.includes(target) || sub.includes(target) || name.includes(target) || desc.includes(target);
}

async function fetchFromOverpass(lat, lon, radius) {
  const query = `[out:json][timeout:15];
(
  node["tourism"~"attraction|museum|viewpoint|zoo|theme_park|gallery|artwork"]["name"](around:${radius},${lat},${lon});
  way["tourism"~"attraction|museum|viewpoint|zoo|theme_park|gallery|artwork"]["name"](around:${radius},${lat},${lon});
  node["historic"~"monument|memorial|castle|fort|ruins|archaeological_site|heritage"]["name"](around:${radius},${lat},${lon});
  way["historic"~"monument|memorial|castle|fort|ruins|archaeological_site|heritage"]["name"](around:${radius},${lat},${lon});
  node["amenity"="place_of_worship"]["name"](around:${radius},${lat},${lon});
  way["amenity"="place_of_worship"]["name"](around:${radius},${lat},${lon});
  node["leisure"~"park|garden|nature_reserve"]["name"](around:${radius},${lat},${lon});
  way["leisure"~"park|garden|nature_reserve"]["name"](around:${radius},${lat},${lon});
  node["natural"~"waterfall|peak"]["name"](around:${radius},${lat},${lon});
  way["natural"~"waterfall|peak"]["name"](around:${radius},${lat},${lon});
  way["waterway"="waterfall"]["name"](around:${radius},${lat},${lon});
);
out center tags 120;`;

  const elements = await queryOverpass(query, {
    cacheKey: `overpass_attr_${lat.toFixed(3)}_${lon.toFixed(3)}_${radius}`,
    timeoutMs: 12000
  });

  const seen = new Set();
  const results = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const coords = getElementCoords(el);
    if (coords.latitude == null || coords.longitude == null) continue;

    // Skip unnamed results
    const name = tags.name || tags['name:en'] || tags['name:ta'] || tags['name:hi'] || '';
    if (!name || name.length < 2) continue;

    // Dedup by OSM id
    const osmKey = `${el.type}_${el.id}`;
    if (seen.has(osmKey)) continue;
    seen.add(osmKey);

    const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);
    if (dist != null && dist > DISTANCE_LIMIT_KM) continue;

    let categoryType = 'Sightseeing';
    if (tags.tourism === 'museum') categoryType = 'Museum';
    else if (tags.historic) categoryType = 'Historical Monument';
    else if (tags.amenity === 'place_of_worship') {
      const rel = tags.religion || '';
      categoryType = rel === 'hindu' ? 'Hindu Temple' : rel === 'muslim' ? 'Mosque' : rel === 'christian' ? 'Church' : 'Place of Worship';
    }
    else if (tags.tourism === 'viewpoint') categoryType = 'Viewpoint';
    else if (tags.leisure === 'park' || tags.leisure === 'garden') categoryType = 'Nature Park';
    else if (tags.natural === 'waterfall' || tags.waterway === 'waterfall') categoryType = 'Waterfall';
    else if (tags.natural === 'peak') categoryType = 'Hilltop / Peak';
    else if (tags.tourism === 'theme_park') categoryType = 'Amusement Park';
    else if (tags.tourism === 'zoo' || tags.tourism === 'aquarium') categoryType = 'Wildlife / Aquarium';

    const entryPrice = tags.fee === 'no' ? 'Free Entry' : tags.charge ? tags.charge : 'Check on site';

    results.push(normalizePoi({
      id: `osm_place_${el.type}_${el.id}`,
      name,
      category: categoryType,
      address: formatAddressFromOsmTags(tags),
      latitude: coords.latitude,
      longitude: coords.longitude,
      phone: tags.phone || tags['contact:phone'] || null,
      rating: null,
      reviews: 0,
      openingHours: tags.opening_hours || null,
      description: tags.description || tags['historic:civilization'] || null,
      source: 'open_public_osm',
      sourceUrl: tags.website || (tags['wikidata'] ? `https://www.wikidata.org/wiki/${tags['wikidata']}` : 'https://www.openstreetmap.org'),
      verified: Boolean(tags.wikidata || tags['heritage'] || tags['historic']),
      distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
      extra: {
        entryPrice,
        subCategory: categoryType,
        facilities: tags.wheelchair === 'yes' ? 'Wheelchair Accessible' : null
      }
    }));
  }

  return results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
}

async function fetchFromDatabase({ latitude, longitude, limit }) {
  if (latitude == null || longitude == null) return [];
  try {
    const latDelta = (DISTANCE_LIMIT_KM / 111) * 1.05;
    const lonDelta = (DISTANCE_LIMIT_KM / (111 * Math.max(0.1, Math.cos(Number(latitude) * Math.PI / 180)))) * 1.05;
    const where = {
      latitude: { gte: Number(latitude) - latDelta, lte: Number(latitude) + latDelta },
      longitude: { gte: Number(longitude) - lonDelta, lte: Number(longitude) + lonDelta }
    };

    const records = await prisma.place.findMany({ where, take: limit || 60, orderBy: { rating: 'desc' } });

    return records
      .map((p) => {
        const dist = latitude != null && longitude != null && p.latitude != null && p.longitude != null
          ? haversineDistanceKm(latitude, longitude, p.latitude, p.longitude)
          : null;
        if (dist != null && dist > DISTANCE_LIMIT_KM) return null;

        return normalizePoi({
          id: p.id,
          name: p.name,
          category: p.category || 'Sightseeing',
          address: p.address || p.location || null,
          latitude: p.latitude,
          longitude: p.longitude,
          phone: null,
          rating: p.rating,
          reviews: p.reviews || 0,
          openingHours: p.openingHours || null,
          description: p.description,
          source: p.source || 'seed_database',
          sourceUrl: null,
          verified: p.verified,
          distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
          extra: { entryPrice: p.entryPrice || null, facilities: p.facilities || null }
        });
      })
      .filter(Boolean)
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  } catch (err) {
    console.warn(`[attractionProvider] DB fallback failed: ${err.message}`);
    return [];
  }
}
