// =============================================================================
// timeZone.js — Real Indian Standard Time (Asia/Kolkata, UTC+05:30) utilities.
// Guarantees all date/time calculations, trip start/end evaluations, active
// detection, and auto-expiration are consistently governed by Asia/Kolkata.
// =============================================================================

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current Date representing the absolute moment in time.
 */
export function getNowIST() {
  return new Date();
}

/**
 * Given a Date or ISO string, formats it to YYYY-MM-DD in Asia/Kolkata.
 */
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

/**
 * Parses a date string or Date object and returns the exact millisecond timestamp
 * corresponding to 23:59:59.999 in Asia/Kolkata on that calendar day.
 */
export function getEndOfDayTimestampIST(dateInput) {
  if (!dateInput) return null;
  const ymd = formatDateInIST(dateInput);
  if (!ymd) return null;
  const isoWithOffset = `${ymd}T23:59:59.999+05:30`;
  const ts = Date.parse(isoWithOffset);
  return isNaN(ts) ? null : ts;
}

/**
 * Extracts and computes the exact journey end timestamp (in ms) for a trip
 * based on Asia/Kolkata.
 *
 * Rules:
 * 1. If trip has endDate, use the end of that day in Asia/Kolkata (or specific time if provided).
 * 2. If trip has startDate, add (durationDays - 1) days and use the end of that day in Asia/Kolkata.
 * 3. If trip has dates string (e.g. "2026-09-10 – 2026-09-12" or "10 Sep 2026 to 12 Sep 2026"),
 *    extract the ending date and use the end of that day in Asia/Kolkata.
 */
export function getTripEndTimestampIST(trip) {
  if (!trip) return null;

  if (trip.endDate) {
    const d = new Date(trip.endDate);
    if (!isNaN(d.getTime())) {
      // If end date has a non-midnight time explicitly set, respect the exact moment
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

/**
 * Checks whether a trip's journey has completely ended in Asia/Kolkata.
 * If status is explicitly 'completed', returns true.
 * Otherwise compares current Indian Standard Time against the trip's journey end timestamp.
 */
export function isTripExpiredIST(trip, now = new Date()) {
  if (!trip) return false;
  if (trip.status === 'completed') return true;

  const endTimestamp = getTripEndTimestampIST(trip);
  if (!endTimestamp) return false;

  const currentMs = now instanceof Date ? now.getTime() : Number(now);
  return currentMs > endTimestamp;
}

/**
 * Checks whether a trip is currently active in Asia/Kolkata.
 */
export function isTripActiveIST(trip, now = new Date()) {
  if (!trip) return false;
  if (trip.status !== 'active') return false;
  return !isTripExpiredIST(trip, now);
}
