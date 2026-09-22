// ============================================================================
// adminService — admin data against the TourGuard AI backend.
// ============================================================================

import { api } from './api.js';
import { getState, setState } from '../store.js';

export async function getUsers() {
  const data = await api.get('/admin/users');
  const users = (data.users || []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    status: (u.status || 'ACTIVE').toLowerCase(),
    phoneVerified: u.phoneVerified,
    joinedAt: u.createdAt?.slice(0, 10),
    tripCount: u._count?.trips || 0,
    reportCount: u._count?.reports || 0
  }));
  setState((s) => ({ ...s, users }));
  return users;
}

export async function getUserById(userId) {
  const u = await api.get(`/admin/users/${userId}`);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    status: (u.status || 'ACTIVE').toLowerCase(),
    joinedAt: u.createdAt?.slice(0, 10),
    tripCount: (u.trips || []).length,
    reportCount: (u.reports || []).length,
    trips: (u.trips || []).map((t) => ({
      id: t.id,
      destination: t.destination,
      dates: t.startDate ? `${t.startDate.slice(0, 10)} – ${t.endDate?.slice(0, 10) || ''}` : '—',
      status: (t.status || 'PLANNED').toLowerCase()
    })),
    reports: (u.reports || []).map((r) => ({
      id: r.id,
      category: r.category,
      location: r.location,
      date: r.createdAt?.slice(0, 10),
      status: r.status
    })),
    sosHistory: (u.sosRequests || []).map((s) => ({
      id: s.id,
      date: s.createdAt?.slice(0, 10),
      type: s.emergencyType,
      location: s.locationText || '',
      status: s.status
    }))
  };
}

export async function updateUserStatus(userId, status) {
  const backendStatus = status === 'blocked' ? 'BLOCKED' : 'ACTIVE';
  await api.patch(`/admin/users/${userId}/status`, { status: backendStatus });
  setState((s) => ({
    ...s,
    users: s.users.map((u) => (u.id === userId ? { ...u, status } : u))
  }));
}

export async function getOverview() {
  const data = await api.get('/admin/overview');
  return {
    totalUsers: data.totalUsers,
    activeTrips: data.activeTrips,
    placesListed: data.placesListed,
    hotelsListed: data.hotelsListed,
    pendingReports: data.pendingReports,
    fareReports: data.fareReports,
    safetyAlerts: data.safetyAlerts,
    activeSOS: data.activeSOS
  };
}

export async function getActivityLog() {
  const logs = await api.get('/admin/activity-logs');
  return logs.map((l) => ({
    action: l.action,
    date: l.createdAt?.slice(0, 10),
    time: l.createdAt ? new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    status: 'done'
  }));
}

export async function getAIStats() {
  const overview = await api.get('/admin/overview');
  const analytics = await api.get('/admin/analytics');
  return {
    tripPlansGenerated: overview.activeTrips || 0,
    recommendations: 0,
    fareChecks: analytics?.smartTravel?.fareChecks || 0,
    reviewSummaries: 0,
    userRating: 4.6,
    modules: [
      { name: 'Trip Planner', usage: overview.activeTrips ? 100 : 0 },
      { name: 'Fare Prediction', usage: analytics?.smartTravel?.fareChecks ? 100 : 0 },
      { name: 'Translation', usage: 0 },
      { name: 'Safety Alerts', usage: overview.safetyAlerts ? 100 : 0 }
    ]
  };
}

export async function getModels() {
  const data = await api.get('/intelligence/models');
  return {
    mlService: data.mlService || { configured: false },
    models: (data.models || []).map((m) => ({
      key: m.key,
      kind: m.kind,
      version: m.version,
      trainingDate: m.trainingDate,
      datasetVersion: m.datasetVersion,
      datasetSource: m.datasetSource,
      status: m.status,
      metrics: m.metrics || {},
      features: m.features || [],
      featureImportance: m.featureImportance || []
    }))
  };
}

export async function getAnalytics() {
  const data = await api.get('/admin/analytics');
  return {
    users: {
      newUsers: data?.users?.newUsers || [],
      activeUsers: data?.users?.activeUsers || [],
      returningUsers: data?.users?.returningUsers || [],
      labels: data?.users?.labels || []
    },
    trips: {
      tripsCreated: data?.trips?.tripsCreated || [],
      popularDestinations: data?.trips?.popularDestinations || [],
      avgTripDuration: data?.trips?.avgTripDuration || '—'
    },
    discover: {
      popularPlaces: data?.discover?.popularPlaces || [],
      popularHotels: data?.discover?.popularHotels || [],
      popularRestaurants: data?.discover?.popularRestaurants || [],
      popularTheatres: data?.discover?.popularTheatres || []
    },
    smartTravel: {
      fareChecks: data?.smartTravel?.fareChecks || 0,
      transportSearches: data?.smartTravel?.transportSearches || 0,
      translationUsage: 0
    },
    safety: {
      safetyReports: data?.safety?.reports || 0,
      sosRequests: data?.safety?.sosRequests || 0,
      safetyAlerts: data?.safety?.activeAlerts || 0
    }
  };
}
