// =============================================================================
// intelligence/config.js — central, validated configuration for the TourGuard AI
// intelligence layer. All thresholds, weights and limits live HERE (not
// scattered across engines) so operators can tune them from environment
// variables without touching code. Nothing sensitive is stored here.
// =============================================================================

import config from '../config/env.js';

function num(name, fallback) {
  const v = process.env[name];
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// --- Fair fare thresholds (rule-based baseline) -----------------------------
// FAIR         : quoted <= expected * fairMaxRatio
// SLIGHTLY_HIGH: between fairMaxRatio and highMinRatio
// OVERCHARGED  : quoted > expected * highMinRatio
const fareThresholds = {
  fairMaxRatio: num('FARE_FAIR_MAX_RATIO', 1.10),
  highMinRatio: num('FARE_HIGH_MIN_RATIO', 1.30)
};

// Vehicle fare parameters: { flagFall (base), perKm, perMinute, minimum }.
const vehicleFares = {
  auto: { baseFare: 30, perKmRate: 12, perMinuteRate: 0, minimum: 40 },
  rickshaw: { baseFare: 15, perKmRate: 9, perMinuteRate: 0, minimum: 20 },
  taxi: { baseFare: 50, perKmRate: 18, perMinuteRate: 0, minimum: 80 },
  cab: { baseFare: 50, perKmRate: 18, perMinuteRate: 0, minimum: 80 },
  bike_taxi: { baseFare: 15, perKmRate: 8, perMinuteRate: 0, minimum: 25 },
  bike: { baseFare: 15, perKmRate: 8, perMinuteRate: 0, minimum: 25 },
  bus: { baseFare: 10, perKmRate: 2, perMinuteRate: 0, minimum: 10 },
  walking: { baseFare: 0, perKmRate: 0, perMinuteRate: 0, minimum: 0 }
};

// --- Recommendation weights (must sum to ~1.0) ------------------------------
const recommendationWeights = {
  rating: num('REC_WEIGHT_RATING', 0.25),
  safety: num('REC_WEIGHT_SAFETY', 0.25),
  distance: num('REC_WEIGHT_DISTANCE', 0.15),
  budget: num('REC_WEIGHT_BUDGET', 0.15),
  travelType: num('REC_WEIGHT_TRAVEL_TYPE', 0.15),
  openingStatus: num('REC_WEIGHT_OPENING', 0.05)
};

// --- Weighted safety score weights (must sum to ~1.0) -----------------------
const safetyWeights = {
  incidentHistory: num('SAFETY_W_INCIDENT', 0.30),
  emergencyAccess: num('SAFETY_W_EMERGENCY_ACCESS', 0.20),
  policeProximity: num('SAFETY_W_POLICE', 0.15),
  hospitalProximity: num('SAFETY_W_HOSPITAL', 0.10),
  lighting: num('SAFETY_W_LIGHTING', 0.10),
  crowd: num('SAFETY_W_CROWD', 0.05),
  transport: num('SAFETY_W_TRANSPORT', 0.05),
  timeRisk: num('SAFETY_W_TIME', 0.05)
};

// Safety level bands (0-100 score).
const safetyLevels = {
  verySafeMin: num('SAFETY_VERY_SAFE_MIN', 90),
  safeMin: num('SAFETY_SAFE_MIN', 75),
  moderateMin: num('SAFETY_MODERATE_MIN', 50)
};

// --- Routing / geography ----------------------------------------------------
const routing = {
  // Average speeds (km/h) used to estimate travel time when the routing
  // provider returns only distance (or for nearest-service ETA).
  speeds: {
    walking: num('ROUTE_SPEED_WALKING', 4.5),
    auto: num('ROUTE_SPEED_AUTO', 24),
    taxi: num('ROUTE_SPEED_TAXI', 28),
    bus: num('ROUTE_SPEED_BUS', 24),
    default: num('ROUTE_SPEED_DEFAULT', 32)
  },
  // Default speed used for emergency-response travel-time estimates (km/h).
  emergencySpeedKmh: num('EMERGENCY_SPEED_KMH', 30)
};

const intelligence = {
  fareThresholds,
  vehicleFares,
  recommendationWeights,
  safetyWeights,
  safetyLevels,
  routing,
  // ML inference service (FastAPI). Empty => ML disabled => graceful fallback.
  mlServiceUrl: process.env.ML_SERVICE_URL || config.mlServiceUrl || '',
  // When true (and ML reachable), log prediction inputs/outputs for drift.
  logPredictions: String(process.env.LOG_PREDICTIONS || 'false').toLowerCase() === 'true'
};

export default intelligence;
