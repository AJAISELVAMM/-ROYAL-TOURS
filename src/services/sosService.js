// ============================================================================
// sosService.js — Real SOS dispatch and status management.
// Single source of truth for location is the browser's live GPS coordinates.
// ============================================================================

import { api } from './api.js';
import { setState } from '../store.js';

function mapType(t) {
  const k = (t || 'MEDICAL').toUpperCase();
  return ['MEDICAL', 'POLICE', 'FIRE', 'HOSPITAL'].includes(k) ? k : 'MEDICAL';
}

export async function createSOS({ touristId, touristName, phone, emergencyType, locationText, latitude, longitude, accuracy }) {
  if (latitude == null || longitude == null) {
    throw new Error('Live GPS location is required to trigger emergency SOS.');
  }

  const data = await api.post('/sos', {
    emergencyType: mapType(emergencyType),
    locationText: locationText || `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`,
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracy: accuracy != null ? Number(accuracy) : null
  });

  const request = {
    id: data.id,
    touristId,
    touristName,
    phone,
    emergencyType,
    locationText: locationText || `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`,
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracy: accuracy != null ? Number(accuracy) : null,
    timestamp: new Date().toISOString(),
    status: (data.status || 'ACTIVE').toLowerCase()
  };

  setState((s) => ({ ...s, sosRequests: [request, ...s.sosRequests] }));
  return { success: true, request };
}

export async function createGroupSOS({ tripId, emergencyType, locationText, latitude, longitude, accuracy }) {
  const data = await api.post('/sos/group', {
    tripId,
    emergencyType: mapType(emergencyType),
    locationText,
    latitude: latitude != null ? Number(latitude) : undefined,
    longitude: longitude != null ? Number(longitude) : undefined,
    accuracy: accuracy != null ? Number(accuracy) : undefined
  });
  return { success: true, id: data.id, status: data.status };
}

export async function updateSOSStatus(id, status) {
  const normalized = (status || 'active').toLowerCase();
  const mapped = normalized === 'resolved'
    ? 'RESOLVED'
    : normalized === 'cancelled'
    ? 'CANCELLED'
    : normalized === 'escalated'
    ? 'ESCALATED'
    : 'ACKNOWLEDGED';

  const data = await api.patch(`/sos/${id}/transition`, { status: mapped });
  setState((s) => ({
    ...s,
    sosRequests: s.sosRequests.map((r) => (r.id === id ? { ...r, status: data.status.toLowerCase() } : r))
  }));
  return { success: true, id, status: data.status.toLowerCase() };
}

export async function cancelSOS(id) {
  const data = await api.patch(`/sos/${id}/transition`, { status: 'CANCELLED' });
  setState((s) => ({
    ...s,
    sosRequests: s.sosRequests.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
  }));
  return { success: true, id, status: data.status.toLowerCase() };
}

export async function getActiveSOS() {
  const list = await api.get('/sos/active');
  const mapped = (list || []).map((r) => ({
    id: r.id,
    touristId: r.userId,
    touristName: r.user?.name || '',
    phone: r.user?.phone || '—',
    emergencyType: r.emergencyType,
    locationText: r.locationText || '',
    latitude: r.latitude,
    longitude: r.longitude,
    accuracy: r.accuracy,
    timestamp: r.createdAt,
    status: (r.status || 'ACTIVE').toLowerCase()
  }));
  setState((s) => ({ ...s, sosRequests: mapped }));
  return mapped;
}

export async function getSOSHistory(userId) {
  try {
    const history = await api.get('/sos/history');
    setState((s) => ({ ...s, sosRequests: history }));
    const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
    return history.map((r) => ({
      id: r.id,
      date: r.createdAt?.slice(0, 10),
      type: r.emergencyType,
      location: r.locationText || '',
      status: title(r.status)
    }));
  } catch {
    return [];
  }
}
