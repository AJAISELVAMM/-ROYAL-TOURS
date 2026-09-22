// ============================================================================
// tripService — trips against the TourGuard AI backend.
// The backend generates the itinerary (selected places + generic fillers),
// the day-wise packing list, and the budget breakdown. The tourist can only
// toggle packing items, re-plan, or add a generic activity.
// ============================================================================

import { api } from './api.js';
import { getState, setState } from '../store.js';
import { isTripExpiredIST, isTripActiveIST, getNowIST } from '../utils/timeZone.js';

export function isTripExpired(trip, now = getNowIST()) {
  return isTripExpiredIST(trip, now);
}

// Map a backend trip record into the frontend's view shape.
function mapTrip(t) {
  const itinerary = {};
  (t.itinerary || []).forEach((day) => {
    itinerary[`day${day.day}`] = (day.activities || []).map((a) => ({
      time: a.time,
      title: a.title,
      type: a.type,
      note: a.note,
      placeId: a.placeId
    }));
  });

  const packing = (t.packing || []).map((d) => ({
    day: d.day,
    places: [],
    reason: d.reason,
    items: (d.items || []).map((it) => ({
      id: it.id,
      label: it.label,
      reason: it.reason,
      done: it.packed
    }))
  }));

  const rawMembers = t.members || [];
  const leftIdentities = new Set();
  rawMembers.forEach((m) => {
    if (m.status === 'LEFT' || m.memberStatus === 'LEFT') {
      if (m.userId) leftIdentities.add(m.userId);
      if (m.user?.id) leftIdentities.add(m.user.id);
      if (m.phone) leftIdentities.add(`phone-${m.phone.replace(/\D/g, '').slice(-10)}`);
      if (m.name) leftIdentities.add(`name-${m.name.toLowerCase().trim()}`);
    }
  });

  const seenMemberIds = new Set();
  const members = rawMembers.filter((m) => {
    const identity = m.userId || m.user?.id || (m.phone ? `phone-${m.phone.replace(/\D/g, '').slice(-10)}` : m.id);
    if (seenMemberIds.has(identity)) return false;
    seenMemberIds.add(identity);
    return true;
  }).map((m) => {
    const cleanPhone = m.phone ? m.phone.replace(/\D/g, '').slice(-10) : '';
    const isLeft = (
      m.status === 'LEFT' ||
      m.memberStatus === 'LEFT' ||
      (m.userId && leftIdentities.has(m.userId)) ||
      (m.user?.id && leftIdentities.has(m.user.id)) ||
      (cleanPhone && leftIdentities.has(`phone-${cleanPhone}`)) ||
      (m.name && leftIdentities.has(`name-${m.name.toLowerCase().trim()}`))
    );

    return {
      id: m.id,
      userId: m.userId || m.user?.id || null,
      name: m.user?.name || m.name,
      phone: m.user?.phone || m.phone,
      avatarUrl: m.user?.avatarUrl || m.avatarUrl || null,
      latitude: isLeft ? null : m.latitude,
      longitude: isLeft ? null : m.longitude,
      isLive: isLeft ? false : Boolean(m.latitude != null && m.longitude != null),
      status: isLeft ? 'offline' : (m.online ? 'online' : 'offline'),
      role: m.role,
      memberStatus: isLeft ? 'LEFT' : m.status
    };
  });

  const expired = isTripExpired(t);
  const effectiveStatus = expired ? 'completed' : (t.status || 'active');
  const finalMembers = effectiveStatus === 'active'
    ? members.filter((m) => m.memberStatus !== 'LEFT' && m.status !== 'LEFT')
    : members;

  const rawBudget = t.budget ?? t.totalBudget ?? t.tripBudget ?? t.estimatedBudget ?? t.budgetAmount ?? 0;
  const normalizedBudget = Number(rawBudget);

  return {
    id: t.id,
    touristId: t.userId,
    touristName: t.user?.name || '',
    hasLeft: Boolean(t.userHasLeft),
    destination: t.destination,
    destinationAddress: t.destinationAddress,
    latitude: t.latitude,
    longitude: t.longitude,
    from: t.from,
    dates: t.dates,
    startDate: t.startDate,
    endDate: t.endDate,
    duration: t.duration,
    durationDays: t.durationDays,
    group: t.groupType,
    memberCount: t.memberCount || (effectiveStatus === 'active' ? finalMembers.length : members.length),
    budget: Number.isFinite(normalizedBudget) ? normalizedBudget : 0,
    totalBudget: Number.isFinite(normalizedBudget) ? normalizedBudget : 0,
    tripBudget: Number.isFinite(normalizedBudget) ? normalizedBudget : 0,
    selectedPlaceIds: (t.places || []).map((p) => p.placeId),
    places: (t.places || []).map((p) => ({
      id: p.placeId,
      name: p.place?.name || '',
      category: p.place?.category || '',
      entryPrice: p.place?.entryPrice || null
    })),
    itinerary,
    budgetBreakdown: t.budgetBreakdown || { hotel: 0, food: 0, transport: 0, entertainment: 0, attractions: 0 },
    expenses: (t.expenses || []).map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
      date: expense.spentAt || expense.date
    })),
    packing,
    members: finalMembers,
    groupData: { members: finalMembers },
    status: effectiveStatus,
    joinCode: t.joinCode || t.groupCode || (t.id ? `TG-${t.id.slice(-6).toUpperCase()}` : ''),
    groupCode: t.joinCode || t.groupCode || (t.id ? `TG-${t.id.slice(-6).toUpperCase()}` : ''),
    createdAt: t.createdAt
  };
}

export async function createGroup(groupData) {
  const data = await api.post('/groups', groupData);
  const rawTrip = data.trip || data.group || data;
  const mapped = mapTrip(rawTrip);
  setState((s) => {
    const existing = (s.trips || []).filter((t) => t.id !== mapped.id);
    return { ...s, trips: [mapped, ...existing], selectedTripId: mapped.id };
  });
  api.get('/trips').then((trips) => {
    if (Array.isArray(trips)) {
      setState((s) => ({ ...s, trips: trips.map(mapTrip) }));
    }
  }).catch(() => {});
  return mapped;
}

export async function getGroup(groupId) {
  const data = await api.get(`/groups/${groupId}`);
  const rawTrip = data.trip || data.group || data;
  const mapped = mapTrip(rawTrip);
  setState((s) => {
    const existing = (s.trips || []).filter((t) => t.id !== mapped.id);
    return { ...s, trips: [mapped, ...existing], selectedTripId: mapped.id };
  });
  return mapped;
}

export async function joinGroup(code) {
  const data = await api.post('/groups/join', { code });
  const rawTrip = data.trip || data.group || data;
  const mapped = mapTrip(rawTrip);
  mapped.alreadyMember = Boolean(data.alreadyMember || rawTrip.alreadyMember);
  setState((s) => {
    const existing = (s.trips || []).filter((t) => t.id !== mapped.id);
    return { ...s, trips: [mapped, ...existing], selectedTripId: mapped.id };
  });
  api.get('/trips').then((trips) => {
    if (Array.isArray(trips)) {
      setState((s) => ({ ...s, trips: trips.map(mapTrip) }));
    }
  }).catch(() => {});
  return mapped;
}

export async function leaveGroup(tripId) {
  const currentUserId = getState().auth?.user?.id;
  // Eagerly mark hasLeft: true immediately in local state
  setState((s) => ({
    ...s,
    trips: (s.trips || []).map((t) => {
      if (t.id === tripId) {
        const remaining = (t.members || []).filter(
          (m) => m.userId !== currentUserId && m.id !== currentUserId
        );
        return {
          ...t,
          hasLeft: true,
          members: remaining,
          memberCount: Math.max(0, remaining.length)
        };
      }
      return t;
    })
  }));

  const data = await api.post(`/groups/${tripId}/leave`);
  const trips = await api.get('/trips').catch(() => null);
  if (trips && Array.isArray(trips)) {
    const mapped = trips.map(mapTrip).map((t) => {
      if (t.id === tripId) {
        return { ...t, hasLeft: true };
      }
      return t;
    });
    setState((s) => ({ ...s, trips: mapped }));
  }
  return data;
}

export async function acceptInvitation(tripId) {
  const data = await api.post(`/trips/${tripId}/invitations/accept`);
  const rawTrip = data.trip || data;
  const mapped = mapTrip(rawTrip);
  setState((s) => {
    const existing = (s.trips || []).filter((t) => t.id !== mapped.id);
    return { ...s, trips: [mapped, ...existing] };
  });
  return mapped;
}

export async function rejectInvitation(tripId) {
  return api.post(`/trips/${tripId}/invitations/reject`);
}


export async function getTrips(touristId) {
  const trips = await api.get('/trips');
  const mapped = trips.map(mapTrip);
  setState((s) => {
    const currentSelection = s.selectedTripId && mapped.some((trip) => trip.id === s.selectedTripId)
      ? s.selectedTripId
      : mapped.find((trip) => trip.status === 'active' && !isTripExpired(trip))?.id || null;
    return { ...s, trips: mapped, selectedTripId: currentSelection };
  });
  return mapped;
}

export async function getTrip(tripId) {
  const trip = await api.get(`/trips/${tripId}`);
  const mapped = mapTrip(trip);
  setState((s) => {
    const existing = (s.trips || []).filter((t) => t.id !== mapped.id);
    return { ...s, trips: [mapped, ...existing], selectedTripId: mapped.id };
  });
  return mapped;
}

export async function getBudget(tripId) {
  return api.get(`/trips/${tripId}/budget`);
}

export async function createExpense(tripId, expense) {
  const data = await api.post(`/trips/${tripId}/budget/expenses`, expense);
  if (data?.expenses) {
    setState((s) => ({
      ...s,
      trips: (s.trips || []).map((t) => (t.id === tripId ? { ...t, expenses: data.expenses } : t))
    }));
  }
  return data;
}

export async function updateExpense(tripId, expenseId, expense) {
  const data = await api.put(`/trips/${tripId}/budget/expenses/${expenseId}`, expense);
  if (data?.expenses) {
    setState((s) => ({
      ...s,
      trips: (s.trips || []).map((t) => (t.id === tripId ? { ...t, expenses: data.expenses } : t))
    }));
  }
  return data;
}

export async function deleteExpense(tripId, expenseId) {
  const data = await api.delete(`/trips/${tripId}/budget/expenses/${expenseId}`);
  if (data?.expenses) {
    setState((s) => ({
      ...s,
      trips: (s.trips || []).map((t) => (t.id === tripId ? { ...t, expenses: data.expenses } : t))
    }));
  }
  return data;
}

export async function getGroupMembers(tripId) {
  const data = await api.get(`/groups/${tripId}/members`);
  const rawList = Array.isArray(data) ? data : (data?.members || []);
  return rawList
    .filter((m) => m.status !== 'LEFT')
    .map((m) => ({
      id: m.id,
      userId: m.userId || m.user?.id || null,
      name: m.user?.name || m.name,
      phone: m.user?.phone || m.phone,
      avatarUrl: m.user?.avatarUrl || m.avatarUrl || null,
      latitude: m.latitude,
      longitude: m.longitude,
      isLive: Boolean(m.latitude != null && m.longitude != null),
      status: m.online ? 'online' : 'offline',
      role: m.role || 'Member',
      memberStatus: m.status || 'ACCEPTED'
    }));
}

// Tourist places for a destination (from the discover catalog).
export async function getPlacesForDestination(destination) {
  const name = (destination || '').trim().toLowerCase();
  if (!name) return [];
  const data = await api.get('/discover/places');
  const items = data.items || [];
  setState((s) => ({ ...s, places: items }));
  return items.filter((p) => (p.location || '').toLowerCase().includes(name) || p.name.toLowerCase().includes(name));
}

// Create a fully personalized trip from the AI Trip Planner flow.
export async function createPlannedTrip({
  touristId,
  touristName,
  destination,
  destinationAddress,
  latitude,
  longitude,
  startDate,
  endDate,
  duration,
  durationDays,
  budget,
  group,
  memberCount,
  members,
  selectedPlaceIds
}) {
  const created = await api.post('/trips', {
    destination,
    destinationAddress,
    latitude,
    longitude,
    startDate,
    endDate,
    duration,
    durationDays,
    budget,
    group,
    memberCount,
    members: (members || []).map((m) => ({ name: m.name, phone: m.phone })),
    selectedPlaceIds
  });
  const trip = await getTrip(created.id);
  setState((s) => ({
    ...s,
    trips: [trip, ...s.trips],
    selectedTripId: trip.id
  }));
  return { success: true, trip };
}

// AI Re-plan — regenerate itinerary + packing + budget from edited inputs.
export async function replanTrip(tripId, { budget, duration, durationDays, selectedPlaceIds }) {
  const trip = await api.post(`/trips/${tripId}/replan`, { budget, duration, durationDays, selectedPlaceIds });
  const mapped = mapTrip(trip);
  setState((s) => ({ ...s, trips: s.trips.map((t) => (t.id === tripId ? mapped : t)) }));
  return { success: true, trip: mapped };
}

// Add a generic activity to a day's itinerary.
export async function addActivity(tripId, day, activity) {
  await api.post(`/trips/${tripId}/itinerary`, {
    day,
    time: activity.time,
    title: activity.title,
    type: activity.type,
    note: activity.note
  });
  const trip = await getTrip(tripId);
  const mapped = mapTrip(trip);
  setState((s) => ({ ...s, trips: s.trips.map((t) => (t.id === tripId ? mapped : t)) }));
  return { success: true, trip: mapped };
}

// Day-wise packing list (toggle-only).
export async function togglePackingItem(tripId, dayIndex, itemId) {
  // Optimistically toggle item in local state for 0ms response
  setState((s) => ({
    ...s,
    trips: (s.trips || []).map((t) => {
      if (t.id !== tripId) return t;
      const updatedPacking = (t.packing || []).map((day) => ({
        ...day,
        items: (day.items || []).map((it) => (it.id === itemId ? { ...it, done: !it.done } : it))
      }));
      return { ...t, packing: updatedPacking };
    })
  }));

  try {
    await api.patch(`/trips/${tripId}/packing/${itemId}`);
  } catch (err) {
    const trip = await getTrip(tripId).catch(() => null);
    if (trip) {
      const mapped = mapTrip(trip);
      setState((s) => ({ ...s, trips: s.trips.map((t) => (t.id === tripId ? mapped : t)) }));
    }
    throw err;
  }
}

// Initiate a call to a group member — backend sanitizes the number and returns
// the dial mode (tel: on mobile, in-app VoIP where configured).
export async function callMember(tripId, memberId) {
  const data = await api.post(`/groups/${tripId}/call`, { memberId });
  return {
    success: data.success,
    phone: data.call?.phone,
    mode: data.call?.mode || 'tel',
    receiver: data.call?.receiver,
    status: data.call?.status
  };
}

// --- Compatibility stubs (kept for any remaining callers) --------------------

export async function editItineraryItem(tripId, day, index, patch) {
  return { success: false };
}

export async function removeItineraryItem(tripId, day, index) {
  return { success: false };
}

export async function updateGroupMemberStatus(tripId, memberId, status) {
  return null;
}

export async function updateTripDates(tripId, dates) {
  return null;
}
