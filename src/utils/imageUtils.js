// =============================================================================
// imageUtils.js — Curated Public & Wikimedia Travel Imagery with Category Fallbacks.
// Pure open/public imagery without requiring paid API keys.
// =============================================================================

export const CATEGORY_FALLBACK_IMAGES = {
  // Places & Attractions
  temple: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80',
  museum: 'https://images.unsplash.com/photo-1565034946487-077786996e27?auto=format&fit=crop&w=800&q=80',
  park: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80',
  nature: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  viewpoint: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  monument: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80',
  historical: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80',
  attraction: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80',
  places: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80',

  // Hospitality & Food
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  hotels: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
  restaurants: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',

  // Entertainment & Leisure
  theatre: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
  theatres: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
  cinema: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
  shopping: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=800&q=80',
  mall: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=800&q=80',

  // Emergency & Public Services
  hospital: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=800&q=80',
  police: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
  pharmacy: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
  emergency: 'https://images.unsplash.com/photo-1587740896339-968901f05484?auto=format&fit=crop&w=800&q=80'
};

export function getFallbackImageForPoi(category, type, name = '') {
  const normCat = (category || '').toLowerCase();
  const normType = (type || '').toLowerCase();
  const normName = (name || '').toLowerCase();

  // Keyword matching
  if (normCat.includes('temple') || normCat.includes('shrine') || normCat.includes('worship') || normName.includes('temple') || normName.includes('kovil')) {
    return CATEGORY_FALLBACK_IMAGES.temple;
  }
  if (normCat.includes('museum') || normName.includes('museum')) {
    return CATEGORY_FALLBACK_IMAGES.museum;
  }
  if (normCat.includes('park') || normCat.includes('garden') || normCat.includes('nature') || normName.includes('park') || normName.includes('lake') || normName.includes('falls')) {
    return CATEGORY_FALLBACK_IMAGES.park;
  }
  if (normCat.includes('viewpoint') || normName.includes('peak') || normName.includes('view') || normName.includes('hill')) {
    return CATEGORY_FALLBACK_IMAGES.viewpoint;
  }
  if (normCat.includes('historic') || normCat.includes('monument') || normName.includes('fort') || normName.includes('palace')) {
    return CATEGORY_FALLBACK_IMAGES.monument;
  }
  if (normType.includes('hotel') || normCat.includes('hotel') || normCat.includes('resort') || normCat.includes('lodge')) {
    return CATEGORY_FALLBACK_IMAGES.hotel;
  }
  if (normType.includes('restaurant') || normCat.includes('food') || normCat.includes('restaurant') || normCat.includes('cafe')) {
    return CATEGORY_FALLBACK_IMAGES.restaurant;
  }
  if (normType.includes('theatre') || normCat.includes('theatre') || normCat.includes('cinema') || normName.includes('cinemas')) {
    return CATEGORY_FALLBACK_IMAGES.theatre;
  }
  if (normType.includes('shopping') || normCat.includes('shop') || normCat.includes('mall') || normCat.includes('bazaar')) {
    return CATEGORY_FALLBACK_IMAGES.shopping;
  }
  if (normType.includes('hospital') || normCat.includes('hospital') || normCat.includes('clinic')) {
    return CATEGORY_FALLBACK_IMAGES.hospital;
  }
  if (normType.includes('police') || normCat.includes('police')) {
    return CATEGORY_FALLBACK_IMAGES.police;
  }
  if (normType.includes('pharmacy') || normCat.includes('pharmacy')) {
    return CATEGORY_FALLBACK_IMAGES.pharmacy;
  }

  return CATEGORY_FALLBACK_IMAGES[normType] || CATEGORY_FALLBACK_IMAGES[normCat] || CATEGORY_FALLBACK_IMAGES.places;
}
