// =============================================================================
// routingService.js — route + fare logic (calls the routing provider).
// =============================================================================

import { getRoute, geocode, routingConfigured } from '../providers/maps/routingProvider.js';
import prisma from '../config/database.js';
import { badRequest } from '../utils/errors.js';

const VEHICLE_PROFILES = {
  bus: 'bus',
  taxi: 'taxi',
  auto: 'auto',
  walking: 'walking',
  walking_foot: 'walking'
};

export async function getTransportRoutes({ from, to, mode }) {
  if (!from || !to) throw badRequest('Both origin and destination are required.');
  const route = await getRoute({ from, to, mode: VEHICLE_PROFILES[mode] || mode });

  // Mode-specific realistic duration calculation
  let modeDurationMinutes = route.durationMinutes;
  const dist = route.distanceKm || 0;
  if (mode === 'auto') {
    modeDurationMinutes = Math.max(1, Math.round(route.durationMinutes * 1.28));
  } else if (mode === 'bus') {
    modeDurationMinutes = Math.max(3, Math.round(6 + (dist / 20) * 60));
  } else if (mode === 'walking' || mode === 'walking_foot') {
    modeDurationMinutes = Math.max(1, Math.round((dist / 4.8) * 60));
  }

  const fare = estimateFare(route.distanceKm, mode);
  return {
    ...route,
    durationMinutes: modeDurationMinutes,
    baseDrivingMinutes: route.durationMinutes,
    mode: mode || 'auto',
    fare,
    provider: routingConfigured() ? 'live' : 'demo'
  };
}

export function estimateFare(distanceKm, vehicleType) {
  const v = String(vehicleType || 'auto').toLowerCase().replace(/[^a-z]/g, '');
  const key = v.includes('cab') || v.includes('taxi') || v.includes('car') ? 'taxi'
    : v.includes('bike') ? 'bike'
    : v === 'rickshaw' || v.includes('erickshaw') || v.includes('cycle') ? 'rickshaw'
    : v.includes('bus') ? 'bus'
    : v.includes('walk') ? 'walking'
    : 'auto';

  const base = {
    auto: { flag: 30, perKm: 12, min: 40 },
    rickshaw: { flag: 15, perKm: 9, min: 20 },
    taxi: { flag: 50, perKm: 18, min: 80 },
    bike: { flag: 15, perKm: 8, min: 25 },
    bus: { flag: 10, perKm: 2, min: 10 },
    walking: { flag: 0, perKm: 0, min: 0 }
  }[key] || { flag: 40, perKm: 15, min: 50 };

  const low = Math.max(base.min, Math.round(base.flag + distanceKm * base.perKm * 0.85));
  const high = Math.max(base.min, Math.round(base.flag + distanceKm * base.perKm * 1.15));
  return { estimatedMin: low, estimatedMax: high, currency: 'INR', source: 'live' };
}

export function fareVerdict(quotedFare, { estimatedMin, estimatedMax }) {
  if (!quotedFare || quotedFare <= 0) return { verdict: 'FAIR', severity: 'low' };
  if (quotedFare > estimatedMax * 1.35) return { verdict: 'POSSIBLE_OVERCHARGE', severity: 'high' };
  if (quotedFare > estimatedMax * 1.1) return { verdict: 'SLIGHTLY_HIGH', severity: 'medium' };
  return { verdict: 'FAIR', severity: 'low' };
}

export async function checkFairFare({ from, to, vehicleType, quotedFare }) {
  if (!from || !to) throw badRequest('Both origin and destination are required.');
  const route = await getRoute({ from, to, mode: VEHICLE_PROFILES[vehicleType] || vehicleType });
  const fare = estimateFare(route.distanceKm, vehicleType);
  const { verdict, severity } = fareVerdict(quotedFare, fare);

  // Persist for analytics.
  await prisma.transportRoute.create({
    data: {
      mode: vehicleType || 'auto',
      from,
      to,
      price: quotedFare || fare.estimatedMax,
      duration: `${route.durationMinutes} min`,
      distanceKm: route.distanceKm
    }
  });

  return {
    from,
    to,
    vehicleType,
    quotedFare: quotedFare || null,
    estimatedMin: fare.estimatedMin,
    estimatedMax: fare.estimatedMax,
    currency: fare.currency,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    verdict,
    severity,
    source: routingConfigured() ? 'live' : 'demo'
  };
}

export async function geocodeLocation(text) {
  return geocode(text);
}
