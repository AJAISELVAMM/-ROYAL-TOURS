// =============================================================================
// normalizer.js — Common object normalization for all category data sources.
// Ensures every provider outputs the exact normalized structure expected by
// the TourGuard backend services and frontend UI without discrepancies.
// =============================================================================

export function normalizePoi({
  id,
  name,
  category = 'facility',
  address = null,
  latitude = null,
  longitude = null,
  phone = null,
  rating = null,
  reviews = 0,
  openingHours = null,
  description = null,
  source = 'unknown',
  sourceUrl = null,
  verified = false,
  distanceKm = null,
  extra = {}
}) {
  return {
    id: String(id || `poi_${Math.random().toString(36).slice(2, 10)}`),
    name: String(name || 'Unnamed Location').trim(),
    category: String(category).toLowerCase(),
    address: address ? String(address).trim() : null,
    latitude: latitude != null ? Number(latitude) : null,
    longitude: longitude != null ? Number(longitude) : null,
    phone: phone ? String(phone).trim() : null,
    rating: rating != null ? Number(rating) : null,
    reviews: reviews != null ? Number(reviews) : 0,
    openingHours: openingHours ? String(openingHours).trim() : null,
    description: description ? String(description).trim() : null,
    source: String(source),
    sourceUrl: sourceUrl ? String(sourceUrl).trim() : null,
    verified: Boolean(verified),
    distanceKm: distanceKm != null ? +Number(distanceKm).toFixed(2) : null,
    ...extra
  };
}

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return +(R * c).toFixed(2);
}

export function formatAddressFromOsmTags(tags = {}) {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:district'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    tags['addr:state'],
    tags['addr:postcode']
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(', ');
  return tags['addr:full'] || tags['operator'] || null;
}
