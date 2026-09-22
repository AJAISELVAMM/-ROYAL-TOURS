const CATEGORIES = [
  { key: 'hotel', label: 'Hotel', percent: 0.36 },
  { key: 'food', label: 'Food', percent: 0.24 },
  { key: 'transport', label: 'Transport', percent: 0.18 },
  { key: 'entertainment', label: 'Entertainment', percent: 0.10 },
  { key: 'attractions', label: 'Attractions', percent: 0.12 }
];

export function parseCost(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[₹,\s]/g, '');
    const match = cleaned.match(/\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return 0;
}

export function getDurationDays(trip) {
  if (trip?.startDate && trip?.endDate) {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diff = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
      return Math.max(1, Math.floor(diff / 86400000) + 1);
    }
  }

  const candidate = Number(trip?.durationDays) || Number.parseInt(trip?.duration, 10) || 1;
  return Math.max(1, candidate || 1);
}

export function getActiveMemberCount(trip) {
  const rawMembers = Array.isArray(trip?.members) ? trip.members : [];
  if (rawMembers.length > 0) {
    const activeMembers = rawMembers.filter((member) => {
      const status = String(member?.memberStatus || member?.status || '').toUpperCase();
      return !['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED'].includes(status);
    });
    if (activeMembers.length > 0) return activeMembers.length;
  }

  const explicitCount = Number(trip?.memberCount) || Number(trip?.groupData?.members?.length) || 0;
  return Math.max(1, explicitCount || 1);
}

export function resolveBudgetTrip(trips, selectedTripId) {
  if (!Array.isArray(trips) || trips.length === 0) return null;
  if (selectedTripId) {
    const selected = trips.find((trip) => trip.id === selectedTripId);
    if (selected) return selected;
  }
  return null;
}

export function buildBudgetAllocation(trip, totalBudget, durationDays, memberCount) {
  const safeTotal = Number(totalBudget) || 0;
  if (safeTotal <= 0) {
    return { hotel: 0, food: 0, transport: 0, entertainment: 0, attractions: 0 };
  }

  // Exact fallback percentage allocation totaling 100%:
  // Hotel = 36%, Food = 24%, Transport = 18%, Entertainment = 10%, Attractions = 12%
  const hotel = Math.round(safeTotal * 0.36);
  const food = Math.round(safeTotal * 0.24);
  const transport = Math.round(safeTotal * 0.18);
  const entertainment = Math.round(safeTotal * 0.10);
  const attractions = safeTotal - hotel - food - transport - entertainment;

  return {
    hotel,
    food,
    transport,
    entertainment,
    attractions: Math.max(0, attractions)
  };
}
