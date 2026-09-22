// =============================================================================
// farePredictionService.js — hybrid fair-fare prediction.
//
// 1. Always compute the transparent rule-based baseline (fareEngine).
// 2. If the ML service is configured and reachable, ask the trained Random
//    Forest for the fareStatus and confidence, and merge with the baseline.
// 3. If ML is unavailable/fails, return the rule-based result untouched so the
//    app keeps working (graceful degradation).
//
// The model is trained OFFLINE (see /ml) and only INFERENCE happens here.
// =============================================================================

import { evaluateFare, computeExpectedFare, overchargePercentage } from './fareEngine.js';
import { predict, mlConfigured } from '../ml/client.js';
import config from '../config.js';
import logger from '../../utils/logger.js';

const MODEL = 'fare';

function baseFareFor(vehicleType) {
  const v = String(vehicleType || 'auto').toLowerCase();
  const key = v.includes('cab') || v.includes('taxi') || v.includes('car') ? 'taxi'
    : v.includes('bike') ? 'bike_taxi'
    : v === 'rickshaw' || v.includes('erickshaw') || v.includes('cycle') ? 'rickshaw'
    : 'auto';
  return (config.vehicleFares[key] || config.vehicleFares.auto).baseFare;
}

// Build the ML-service request payload from the same inputs the engine uses.
function toMLPayload(input) {
  return {
    vehicleType: (input.vehicleType || 'AUTO').toUpperCase(),
    distanceKm: Number(input.distanceKm) || 0,
    durationMinutes: Number(input.durationMinutes) || 0,
    timeOfDay: input.timeOfDay || 'DAY',
    dayOfWeek: input.dayOfWeek || 'WEEKDAY',
    trafficLevel: input.trafficLevel || 'NORMAL',
    weatherCondition: input.weatherCondition || 'CLEAR',
    baseFare: input.baseFare != null ? Number(input.baseFare) : baseFareFor(input.vehicleType),
    perKmRate: input.perKmRate ?? null,
    perMinuteRate: input.perMinuteRate ?? null,
    surgeMultiplier: Number(input.surgeMultiplier) || 1,
    quotedFare: Number(input.quotedFare) || null
  };
}

export async function predictFare(input) {
  const baseline = evaluateFare(input);

  if (!mlConfigured()) {
    return { ...baseline, method: 'rule_based', modelVersion: null };
  }

  try {
    const payload = toMLPayload(input);
    const res = await predict(MODEL, payload);
    const rawConf = Number(res?.confidence ?? res?.probability ?? baseline.confidence);
    const confidence = Number.isFinite(rawConf) ? (rawConf > 1 ? rawConf / 100 : Math.max(0, Math.min(1, rawConf))) : baseline.confidence;

    const prediction = res?.prediction || res?.fareStatus || res?.status || baseline.status;

    // Merge: keep the transparent baseline numbers, use the model's class +
    // confidence, and add the model's own explanation when provided.
    return {
      ...baseline,
      status: normalizeStatus(prediction),
      confidence,
      mlPrediction: normalizeStatus(prediction),
      modelVersion: res?.modelVersion || res?.model_version || 'fare_model_v1',
      method: 'random_forest',
      explanation: (res?.explanation && res.explanation.length ? res.explanation : baseline.explanation)
    };
  } catch (err) {
    logger.warn('Fare ML prediction failed — using rule-based fallback', { error: err.message });
    return { ...baseline, method: 'rule_based', modelVersion: null, mlError: err.code || 'ML_UNAVAILABLE' };
  }
}

function normalizeStatus(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'SLIGHTLY_HIGH' || v === 'SLIGHTLYHIGH') return 'SLIGHTLY_HIGH';
  if (v === 'OVERCHARGED') return 'OVERCHARGED';
  return 'FAIR';
}

// Re-export the deterministic pieces so route/transport code can reuse them
// without importing two modules.
export { computeExpectedFare, overchargePercentage };
