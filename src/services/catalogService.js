// ============================================================================
// catalogService — catalog data against the TourGuard AI backend.
// Tourist reads (list/getOne) hit /api/discover; admin CRUD hits /api/admin/catalog.
// ============================================================================

import { api } from './api.js';
import { getState, setState } from '../store.js';

const collections = ['places', 'hotels', 'restaurants', 'theatres', 'shopping'];

function normalize(name, item) {
  if (name === 'hotels') {
    return {
      ...item,
      facilities:
        typeof item.facilities === 'string'
          ? item.facilities.split(',').map((s) => s.trim()).filter(Boolean)
          : item.facilities || []
    };
  }
  return item;
}

export async function list(name, params = {}, options = {}) {
  if (name === 'transport') {
    const routes = await api.get('/transport/options', options);
    setState((s) => ({ ...s, transport: routes }));
    return routes;
  }

  const queryParams = new URLSearchParams();
  if (params.latitude != null) queryParams.append('latitude', params.latitude);
  if (params.longitude != null) queryParams.append('longitude', params.longitude);
  if (params.search) queryParams.append('search', params.search);
  if (params.category) queryParams.append('category', params.category);
  if (params.rating) queryParams.append('rating', params.rating);
  // Always pass radius (default 60km) and limit
  queryParams.append('radius', params.radius || 60000);
  queryParams.append('limit', params.limit || 50);

  const qs = queryParams.toString();
  const url = `/discover/${name}${qs ? `?${qs}` : ''}`;
  const data = await api.get(url, options);
  let items = (data.items || []).map((i) => normalize(name, i));

  setState((s) => ({ ...s, [name]: items }));
  return items;
}

export async function getOne(name, id) {
  if (name === 'transport') return null;
  let item = await api.get(`/discover/${name}/${id}`);
  item = normalize(name, item);
  if (name === 'theatres') {
    try {
      const detail = await api.get(`/discover/theatres/${id}/shows`);
      const shows = detail.shows || [];
      item = {
        ...item,
        currentMovies: [...new Set(shows.map((s) => s.movieTitle))],
        showTimings: [...new Set(shows.map((s) => s.showTime))],
        liveShowtimesAvailable: detail.liveShowtimesAvailable
      };
    } catch {
      item = { ...item, currentMovies: [], showTimings: [], liveShowtimesAvailable: false };
    }
  }
  return item;
}

export async function addItem(name, item) {
  const record = await api.post(`/admin/catalog/${name}`, item);
  return record;
}

export async function updateItem(name, id, patch) {
  return api.patch(`/admin/catalog/${name}/${id}`, patch);
}

export async function removeItem(name, id) {
  await api.delete(`/admin/catalog/${name}/${id}`);
  setState((s) => ({ ...s, [name]: (s[name] || []).filter((i) => i.id !== id) }));
}

export async function verifyItem(name, id, verified = true) {
  return api.patch(`/admin/catalog/${name}/${id}/verify`, { verified });
}

export async function getVerifiedCount(name) {
  const items = await list(name);
  return items.filter((i) => i.verified).length;
}

export function collectionNames() {
  return collections;
}
