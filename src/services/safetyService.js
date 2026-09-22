// ============================================================================
// safetyService — travel reports + safety alerts against the backend.
// ============================================================================

import { api } from './api.js';
import { getState, setState } from '../store.js';

const CATEGORY_MAP = {
  Fare: 'FARE',
  Restaurant: 'RESTAURANT',
  Shop: 'SHOP',
  Attraction: 'ATTRACTION',
  Other: 'OTHER'
};

const STATUS_TO_BACKEND = {
  'Under Review': 'UNDER_REVIEW',
  'Resolved': 'RESOLVED',
  'Rejected': 'REJECTED'
};

const CATEGORY_LABELS = {
  FARE: 'Fare',
  RESTAURANT: 'Restaurant',
  SHOP: 'Shop',
  ATTRACTION: 'Attraction',
  OTHER: 'Other'
};

function mapReport(r) {
  return {
    id: r.id,
    touristId: r.userId,
    touristName: r.user?.name || '',
    category: CATEGORY_LABELS[r.category] || r.category,
    location: r.location,
    description: r.description,
    expectedPrice: r.expectedPrice,
    chargedPrice: r.chargedPrice,
    evidence: r.evidence || 'No photo attached',
    status: r.status === 'UNDER_REVIEW' ? 'Under Review' : r.status === 'RESOLVED' ? 'Resolved' : 'Rejected',
    date: r.createdAt?.slice(0, 10)
  };
}

// Submit a report — identity is derived from the JWT on the backend.
export async function submitReport({ category, location, latitude, longitude, description, expectedPrice, chargedPrice, photo }) {
  const data = await api.post('/reports', {
    category: CATEGORY_MAP[category] || 'OTHER',
    location,
    latitude: latitude != null ? latitude : null,
    longitude: longitude != null ? longitude : null,
    description,
    expectedPrice: Number(expectedPrice) || 0,
    chargedPrice: Number(chargedPrice) || 0,
    evidence: photo || null
  });
  return { success: true, report: { id: data.id, status: data.status, category, location, description } };
}

export async function getReports() {
  const reports = await api.get('/reports');
  const mapped = reports.map(mapReport);
  setState((s) => ({ ...s, reports: mapped }));
  return mapped;
}

export async function getMyReports() {
  const reports = await api.get('/reports/mine');
  return reports.map(mapReport);
}

export async function updateReportStatus(id, status) {
  const data = await api.patch(`/reports/${id}/status`, { status: STATUS_TO_BACKEND[status] || 'RESOLVED' });
  setState((s) => ({
    ...s,
    reports: s.reports.map((r) => (r.id === id ? mapReport(data) : r))
  }));
}

export async function getSafetyAlerts() {
  const data = await api.get('/safety/map');
  const alerts = (data.alerts || []).map((a) => ({
    id: a.id,
    type: a.type,
    location: a.location,
    severity: (a.severity || 'medium').toLowerCase(),
    status: (a.status || 'active').toLowerCase(),
    date: a.createdAt?.slice(0, 10),
    description: a.description
  }));
  setState((s) => ({ ...s, safetyAlerts: alerts }));
  return alerts;
}

// Safety map — markers + active alerts from the backend.
export async function getSafetyMap(latitude, longitude) {
  const qs = latitude != null && longitude != null ? `?latitude=${latitude}&longitude=${longitude}` : '';
  const data = await api.get(`/safety/map${qs}`);
  const rawList = data.facilities || data.markers || [];
  const facilities = rawList
    .filter((m) => (m.latitude != null || m.lat != null) && (m.longitude != null || m.lon != null))
    .map((m, i) => {
      const lat = Number(m.latitude ?? m.lat);
      const lon = Number(m.longitude ?? m.lon);
      const distMeters =
        m.distanceMeters != null
          ? Number(m.distanceMeters)
          : m.distanceKm != null
          ? Math.round(Number(m.distanceKm) * 1000)
          : null;
      return {
        id: m.id || `fac-${i}`,
        name: m.name,
        type: m.type || m.category || 'EMERGENCY',
        category: (m.category || m.type || 'emergency').toLowerCase(),
        phone: m.phone,
        address: m.address,
        latitude: lat,
        longitude: lon,
        distanceKm: m.distanceKm != null ? Number(m.distanceKm) : distMeters != null ? +(distMeters / 1000).toFixed(2) : null,
        distanceMeters: distMeters
      };
    })
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));

  const nearestPolice =
    data.nearestPolice ||
    facilities.find((f) => (f.type || f.category || '').toUpperCase().includes('POLICE')) ||
    null;
  const nearestHospital =
    data.nearestHospital ||
    facilities.find(
      (f) =>
        (f.type || f.category || '').toUpperCase().includes('HOSPITAL') ||
        (f.type || f.category || '').toUpperCase().includes('CLINIC')
    ) ||
    null;

  return {
    facilities,
    nearestPolice,
    nearestHospital,
    policeDistanceKm: nearestPolice?.distanceKm ?? data.policeDistanceKm ?? null,
    hospitalDistanceKm: nearestHospital?.distanceKm ?? data.hospitalDistanceKm ?? null,
    policeDistanceMeters: nearestPolice?.distanceMeters ?? data.policeDistanceMeters ?? null,
    hospitalDistanceMeters: nearestHospital?.distanceMeters ?? data.hospitalDistanceMeters ?? null,
    alerts: (data.alerts || []).map((a) => ({
      id: a.id,
      type: a.type,
      severity: (a.severity || 'medium').toLowerCase(),
      location: a.location,
      description: a.description
    })),
    safetyScore: data.safetyScore || 85,
    safetyLevel: data.safetyLevel || 'SAFE'
  };
}

const DESTINATION_TYPES = {
  hotel: 'HOTEL',
  transport: 'TRANSPORT',
  safe: 'SAFE_PLACE',
  hospital: 'HOSPITAL',
  police: 'POLICE'
};

// "I'm Lost" guidance — nearest destination + walking route.
export async function getGuide({ latitude, longitude, destinationType }) {
  const data = await api.post('/safety/guide', {
    currentLatitude: latitude,
    currentLongitude: longitude,
    destinationType: DESTINATION_TYPES[destinationType] || 'HOSPITAL'
  });
  return {
    destination: data.destination,
    distanceKm: data.distanceKm,
    route: data.route
  };
}

// Nearest emergency facility of a given type.
export async function getNearestHelp({ latitude, longitude, type }) {
  const qs = `latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&type=${encodeURIComponent(type || 'all')}`;
  const data = await api.get(`/emergency/nearest?${qs}`);
  const rawList = Array.isArray(data) ? data : data.facilities || data.items || (data.name ? [data] : []);
  const facilities = rawList
    .filter((m) => (m.latitude != null || m.lat != null) && (m.longitude != null || m.lon != null))
    .map((m, i) => {
      const lat = Number(m.latitude ?? m.lat);
      const lon = Number(m.longitude ?? m.lon);
      const distMeters =
        m.distanceMeters != null
          ? Number(m.distanceMeters)
          : m.distanceKm != null
          ? Math.round(Number(m.distanceKm) * 1000)
          : null;
      return {
        id: m.id || `emerg-fac-${i}`,
        name: m.name,
        type: m.type || m.category || 'EMERGENCY',
        category: (m.category || m.type || 'emergency').toLowerCase(),
        phone: m.phone,
        address: m.address,
        latitude: lat,
        longitude: lon,
        distanceKm: m.distanceKm != null ? Number(m.distanceKm) : distMeters != null ? +(distMeters / 1000).toFixed(2) : null,
        distanceMeters: distMeters,
        openStatus: m.openStatus || 'OPEN'
      };
    })
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));

  return {
    ...facilities[0],
    facilities,
    items: facilities
  };
}

export async function getNearestEmergency(latitude, longitude, type = 'all') {
  return getNearestHelp({ latitude, longitude, type });
}

// Hybrid safety prediction (Random Forest + weighted score + nearby services).
export async function getSafetyPrediction({ latitude, longitude, timeOfDay, dayOfWeek }) {
  const data = await api.post('/intelligence/safety/predict', {
    latitude,
    longitude,
    timeOfDay: timeOfDay || 'DAY',
    dayOfWeek: dayOfWeek || 'WEEKDAY'
  });
  return {
    safetyScore: data.safetyScore,
    safetyLevel: data.safetyLevel,
    mlPrediction: data.mlPrediction,
    mlConfidence: data.mlConfidence,
    confidence: data.mlConfidence,
    method: data.method,
    modelVersion: data.modelVersion,
    riskFactors: data.riskFactors || [],
    breakdown: data.breakdown || {},
    nearbyEmergencyServices: data.nearbyEmergencyServices || []
  };
}

export async function getSafetyAssessment(params) {
  return getSafetyPrediction(params);
}

export async function submitSafetyReport() {
  return { success: false };
}

export async function updateAlertStatus(id, status) {
  return { success: false };
}

export async function escalateAlert(id) {
  return { success: false };
}
