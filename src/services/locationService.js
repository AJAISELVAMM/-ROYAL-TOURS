// =============================================================================
// locationService.js — Frontend Live Location Service.
// =============================================================================

import { api } from './api.js';

export async function getCurrentLocation(userId) {
  return api.get(userId ? `/location/current?userId=${encodeURIComponent(userId)}` : '/location/current');
}

export async function updateLocation(payload) {
  return api.post('/location/update', payload);
}

export async function getLocationHistory(limit = 50) {
  return api.get(`/location/history?limit=${limit}`);
}

export async function startGroupSharing(groupId, coords) {
  return api.post(`/location/${groupId}/start`, coords);
}

export async function stopGroupSharing(groupId) {
  return api.post(`/location/${groupId}/stop`);
}

export async function reverseGeocode(latitude, longitude) {
  return api.get(`/geocoding/reverse?latitude=${latitude}&longitude=${longitude}`);
}
