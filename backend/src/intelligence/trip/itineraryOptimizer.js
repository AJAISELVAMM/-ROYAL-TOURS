// =============================================================================
// itineraryOptimizer.js — distribute + order selected places across days.
//
// Optimizes for travel distance/time by (a) balancing places across days and
// (b) ordering each day's places with a greedy nearest-neighbour pass so the
// route backtracks as little as possible. Assigns time slots, estimated travel
// time (Haversine ÷ speed) and estimated cost (entry price).
//
// Only SELECTED places are ever scheduled — unselected attractions are never
// injected. When fewer places than time slots exist, generic activities
// (meals/rest/free time) fill the remainder.
//
// A* (astRouter) is used for real path-finding when a road graph is supplied;
// for catalog places we use straight-line (Haversine) estimates, which is the
// honest heuristic — not a fabricated route.
// =============================================================================

import { haversineKm } from '../geo/haversine.js';
import config from '../config.js';

const SLOTS = ['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:30 PM'];

function toMinutes(t) {
  const m = (t || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function to12h(minutes) {
  let h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;
}

// Estimate cost of a place from entry price string (transparent, best-effort).
export function estimatePlaceCost(entryPrice) {
  const s = String(entryPrice || '');
  const nums = s.match(/\d+/g);
  if (!nums) return 0;
  const values = nums.map(Number).filter((n) => n > 0);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// Straight-line distance between two places; falls back to the catalog
// `distanceKm` (city-centre distance) delta when coordinates are missing, and
// finally to 0 so ordering never fails on un-geocoded catalog data.
function distanceBetween(a, b) {
  const aHas = a.latitude != null && a.longitude != null;
  const bHas = b.latitude != null && b.longitude != null;
  if (aHas && bHas) return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  if (a.distanceKm != null && b.distanceKm != null) return Math.abs(a.distanceKm - b.distanceKm);
  return 0;
}

// Greedy nearest-neighbour ordering from a start coordinate (falls back to
// catalog distance when a place is not geocoded).
function orderByNearestNeighbour(places, start) {
  const remaining = [...places];
  const ordered = [];
  let anchor = start && start.latitude != null ? start : null;
  while (remaining.length) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = anchor ? distanceBetween(anchor, remaining[i]) : 0;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0];
    ordered.push({ place: next, travelFromPrevKm: bestDist });
    anchor = next.latitude != null && next.longitude != null ? next : anchor;
  }
  return ordered;
}

function getVisitDurationMinutes(category) {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('museum') || cat.includes('sanctuary') || cat.includes('zoo') || cat.includes('theme')) return 120;
  if (cat.includes('temple') || cat.includes('fort') || cat.includes('palace') || cat.includes('park') || cat.includes('falls')) return 90;
  if (cat.includes('lake') || cat.includes('viewpoint') || cat.includes('monument') || cat.includes('church') || cat.includes('mosque')) return 60;
  return 75;
}

// Split places into `days` balanced groups (preserving input order, then
// reordered per-day by nearest neighbour).
function distribute(places, days) {
  const groups = Array.from({ length: days }, () => []);
  places.forEach((p, i) => groups[i % days].push(p));
  return groups.filter((g) => g.length > 0);
}

export function optimizeItinerary({ places, durationDays = 2, startLat, startLon, travelType = 'SOLO', startDate = null }) {
  if (!Array.isArray(places) || places.length === 0) {
    throw new Error('At least one place is required to optimize an itinerary.');
  }

  const days = Math.max(1, Number(durationDays) || 2);
  const groups = distribute(places, days);
  const speed = config.routing.speeds.default || 35;
  const itinerary = [];
  let totalCost = 0;
  let totalTravelKm = 0;

  const start = startLat != null && startLon != null ? { latitude: startLat, longitude: startLon } : null;

  // Base morning start time: 08:00 AM (480 minutes)
  const baseMorningStart = 8 * 60;

  groups.forEach((group, idx) => {
    const day = idx + 1;
    const ordered = orderByNearestNeighbour(group, start);
    const activities = [];
    let currentMin = baseMorningStart;
    let hadLunch = false;

    // If day has only 1 attraction, include a morning start at 08:00 AM and place attraction at 09:30 AM
    if (ordered.length === 1) {
      activities.push({
        time: to12h(currentMin),
        title: 'Morning Tour Briefing & Breakfast',
        type: 'Meal',
        note: 'Start the day with authentic local breakfast'
      });
      currentMin = 9 * 60 + 30; // 09:30 AM
    }

    ordered.forEach((entry, i) => {
      const p = entry.place;
      const travelMinutes = i === 0 && ordered.length > 1 ? 0 : Math.max(15, Math.round((entry.travelFromPrevKm / speed) * 60));
      totalTravelKm += entry.travelFromPrevKm;
      const cost = estimatePlaceCost(p.entryPrice);
      totalCost += cost;

      // Check if lunch should happen before this attraction
      if (!hadLunch && currentMin >= 12 * 60 + 30) {
        activities.push({
          time: to12h(13 * 60), // 01:00 PM
          title: 'Lunch & Rest',
          type: 'Meal',
          note: 'Traditional regional cuisine'
        });
        hadLunch = true;
        currentMin = Math.max(currentMin, 14 * 60); // 02:00 PM
      }

      const visitMinutes = getVisitDurationMinutes(p.category);

      activities.push({
        time: to12h(currentMin),
        title: p.name,
        category: p.category || 'Attraction',
        type: 'Attraction',
        placeId: p.id,
        estimatedTravelMinutes: travelMinutes,
        estimatedCost: cost,
        note: p.category || null
      });

      currentMin += visitMinutes + travelMinutes;

      // Check if lunch should happen after this attraction
      if (!hadLunch && currentMin >= 12 * 60 + 15 && currentMin <= 14 * 60 + 30) {
        const lunchTime = Math.max(currentMin, 13 * 60);
        activities.push({
          time: to12h(lunchTime),
          title: 'Lunch & Rest',
          type: 'Meal',
          note: 'Traditional regional cuisine'
        });
        hadLunch = true;
        currentMin = lunchTime + 60;
      }
    });

    // If lunch hasn't been added yet (e.g. morning attractions ended before noon)
    if (!hadLunch) {
      activities.push({
        time: '01:00 PM',
        title: 'Lunch & Rest',
        type: 'Meal',
        note: 'Traditional regional cuisine'
      });
      currentMin = Math.max(currentMin, 14 * 60);
    }

    // Add evening free time / marketplace if done early
    if (currentMin <= 17 * 60) {
      activities.push({
        time: to12h(Math.max(currentMin, 15 * 60 + 30)),
        title: 'Local Culture & Evening Stroll',
        type: 'Free Time',
        note: 'Explore nearby markets, handicrafts and scenic streets'
      });
      currentMin = Math.max(currentMin, 17 * 60 + 30);
    }

    // Dinner at 07:00 PM or 07:30 PM
    const dinnerMin = Math.max(currentMin, 19 * 60);
    activities.push({
      time: to12h(dinnerMin),
      title: 'Dinner & Relaxation',
      type: 'Meal',
      note: 'Dinner at recommended local restaurant'
    });

    activities.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
    itinerary.push({ day, activities });
  });

  // Ensure every requested day has an entry (free days use generic fillers).
  for (let d = 1; d <= days; d++) {
    if (!itinerary.find((x) => x.day === d)) {
      itinerary.push({
        day: d,
        activities: [
          { time: '08:00 AM', title: 'Breakfast & Morning Briefing', type: 'Meal', note: 'Start the day energized' },
          { time: '09:30 AM', title: 'City Heritage & Landmarks', type: 'Free Time', note: 'Explore local historical streets' },
          { time: '01:00 PM', title: 'Lunch & Rest', type: 'Meal', note: 'Traditional regional cuisine' },
          { time: '03:30 PM', title: 'Artisan Markets & Sightseeing', type: 'Free Time', note: 'Souvenirs and photography' },
          { time: '07:00 PM', title: 'Dinner & Relaxation', type: 'Meal', note: 'Evening dining experience' }
        ]
      });
    }
  }

  itinerary.sort((a, b) => a.day - b.day);

  return {
    itinerary,
    summary: {
      totalPlaces: places.length,
      days,
      estimatedTotalTravelKm: +totalTravelKm.toFixed(2),
      estimatedTotalCost: totalCost,
      travelType
    }
  };
}
