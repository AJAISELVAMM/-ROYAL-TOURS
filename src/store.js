// ============================================================================
// TourGuard AI — reactive in-memory cache.
// A tiny observable store. Services fetch from the backend and write results
// here so components that read via useStore() re-render on data changes.
// No localStorage persistence, no mock/seed data — the backend is the source
// of truth.
// ============================================================================

function readSelectedTripId() {
  try {
    return localStorage.getItem('tourguard_selected_trip_id') || null;
  } catch {
    return null;
  }
}

const INITIAL_STATE = {
  places: [],
  hotels: [],
  restaurants: [],
  theatres: [],
  shopping: [],
  transport: [],
  trips: [],
  users: [],
  reports: [],
  safetyAlerts: [],
  sosRequests: [],
  selectedTripId: readSelectedTripId()
};

let state = { ...INITIAL_STATE };
const listeners = new Set();

export function getState() {
  return state;
}

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(state) : updater;
  if (next === state) return state;
  const previousSelectedTripId = state.selectedTripId;
  state = next;
  if (next.selectedTripId !== previousSelectedTripId) {
    try {
      if (next.selectedTripId) localStorage.setItem('tourguard_selected_trip_id', next.selectedTripId);
      else localStorage.removeItem('tourguard_selected_trip_id');
    } catch {}
  }
  listeners.forEach((l) => l(state));
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetState() {
  state = { ...INITIAL_STATE };
  listeners.forEach((l) => l(state));
  return state;
}

// Small id helper kept for UI keys; the backend assigns real ids.
export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
