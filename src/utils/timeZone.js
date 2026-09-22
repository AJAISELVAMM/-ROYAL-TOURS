// =============================================================================
// timeZone.js — Real Indian Standard Time (Asia/Kolkata, UTC+05:30) utilities.
// Ensures frontend trip active/expired evaluations match backend logic exactly.
// =============================================================================

export const IST_TIMEZONE = 'Asia/Kolkata';

export function getNowIST() {
  return new Date();
}

export function formatDateInIST(date) {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function getEndOfDayTimestampIST(dateInput) {
  if (!dateInput) return null;
  const ymd = formatDateInIST(dateInput);
  if (!ymd) return null;
  const isoWithOffset = `${ymd}T23:59:59.999+05:30`;
  const ts = Date.parse(isoWithOffset);
  return isNaN(ts) ? null : ts;
}

export function getTripEndTimestampIST(trip) {
  if (!trip) return null;

  if (trip.endDate) {
    const d = new Date(trip.endDate);
    if (!isNaN(d.getTime())) {
      const hasSpecificTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
      if (hasSpecificTime) {
        return d.getTime();
      }
      return getEndOfDayTimestampIST(d);
    }
  }

  if (trip.startDate) {
    const d = new Date(trip.startDate);
    if (!isNaN(d.getTime())) {
      const days = trip.durationDays || 2;
      const endD = new Date(d.getTime() + (Math.max(1, days) - 1) * 24 * 60 * 60 * 1000);
      return getEndOfDayTimestampIST(endD);
    }
  }

  if (trip.dates && typeof trip.dates === 'string') {
    const parts = trip.dates.split(/\s+(?:to|–|—|-)\s+/i);
    const lastPart = parts[parts.length - 1].trim();
    const parsed = new Date(lastPart);
    if (!isNaN(parsed.getTime())) {
      return getEndOfDayTimestampIST(parsed);
    }
  }

  return null;
}

export function isTripExpiredIST(trip, now = new Date()) {
  if (!trip) return false;
  if (trip.status === 'completed') return true;

  const endTimestamp = getTripEndTimestampIST(trip);
  if (!endTimestamp) return false;

  const currentMs = now instanceof Date ? now.getTime() : Number(now);
  return currentMs > endTimestamp;
}

export function isTripActiveIST(trip, now = new Date()) {
  if (!trip) return false;
  if (trip.status !== 'active') return false;
  return !isTripExpiredIST(trip, now);
}
