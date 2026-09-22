// ============================================================================
// fareService — fair-fare prediction against the TourGuard AI intelligence API.
// The backend returns the transparent rule baseline PLUS the Random Forest
// prediction (with confidence + explanation) when the ML service is online,
// and gracefully falls back to the rule engine when it is not.
// ============================================================================

import { api } from './api.js';

const VEHICLE_KEYS = {
  Auto: 'AUTO',
  auto: 'AUTO',
  AUTO: 'AUTO',
  Rickshaw: 'RICKSHAW',
  rickshaw: 'RICKSHAW',
  RICKSHAW: 'RICKSHAW',
  Taxi: 'CAB',
  taxi: 'CAB',
  TAXI: 'CAB',
  Cab: 'CAB',
  cab: 'CAB',
  CAB: 'CAB',
  'Cab / Taxi': 'CAB',
  'Bike Taxi': 'BIKE_TAXI',
  'bike-taxi': 'BIKE_TAXI',
  bike: 'BIKE_TAXI',
  BIKE: 'BIKE_TAXI',
  BIKE_TAXI: 'BIKE_TAXI',
  Bus: 'BUS',
  bus: 'BUS',
  BUS: 'BUS'
};

export const STATUS_LABELS = {
  FAIR: 'Fair Fare',
  SLIGHTLY_HIGH: 'Slightly High',
  OVERCHARGED: 'Overcharged'
};

export async function predictFare({ from, to, vehicleType, quotedFare, distanceKm, durationMinutes }) {
  const normalizedVehicle = VEHICLE_KEYS[vehicleType] || (typeof vehicleType === 'string' ? vehicleType.toUpperCase() : 'AUTO');
  const payload = {
    vehicleType: normalizedVehicle,
    quotedFare: quotedFare != null && quotedFare !== '' ? Number(quotedFare) : null
  };
  if (distanceKm != null) payload.distanceKm = Number(distanceKm);
  if (durationMinutes != null) payload.durationMinutes = Number(durationMinutes);

  const data = await api.post('/intelligence/fare/predict', payload);

  const rawConf = Number(data.confidence ?? data.mlConfidence ?? NaN);
  const confidence = Number.isFinite(rawConf) ? (rawConf > 1 ? rawConf / 100 : rawConf) : null;

  return {
    status: data.status,
    fareStatus: data.status,
    verdict: STATUS_LABELS[data.status] || data.status,
    confidence,
    expectedFare: data.expectedFare ?? data.estimatedFare ?? data.fairFare,
    estimatedFare: data.estimatedFare ?? data.expectedFare ?? data.fairFare,
    fairFare: data.fairFare ?? data.expectedFare ?? data.estimatedFare,
    quoted: data.quotedFare,
    distanceKm: data.distanceKm,
    durationMinutes: data.durationMinutes,
    breakdown: data.breakdown || {},
    overchargePercentage: data.overchargePercentage,
    riskLevel: data.riskLevel,
    explanation: data.explanation || [],
    method: data.method, // 'random_forest' | 'rule_based'
    modelVersion: data.modelVersion || null
  };
}

// Backward-compatible alias kept for any older callers.
export async function estimateFare(args) {
  return predictFare(args);
}
