// =============================================================================
// safetyPredictionService.js — hybrid safety prediction.
//
// 1. Always compute the transparent weighted safety score (safetyScoreEngine).
// 2. If the ML service is reachable, ask the trained Random Forest for the
//    safetyLevel + confidence and merge.
// 3. On any failure, return the weighted score alone (graceful degradation).
// =============================================================================

import { computeSafetyScore, levelForScore, riskFactors } from './safetyScoreEngine.js';
import { predict, mlConfigured } from '../ml/client.js';
import logger from '../../utils/logger.js';

const MODEL = 'safety';

function toMLPayload(input) {
  return {
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    timeOfDay: input.timeOfDay || 'DAY',
    dayOfWeek: input.dayOfWeek || 'WEEKDAY',
    policeDistanceKm: input.policeDistanceKm ?? null,
    hospitalDistanceKm: input.hospitalDistanceKm ?? null,
    fireStationDistanceKm: input.fireStationDistanceKm ?? null,
    emergencyResponseDistanceKm: input.emergencyResponseDistanceKm ?? null,
    incidentCount: Number(input.incidentCount) || 0,
    crimeReports: Number(input.crimeReports) || 0,
    touristReports: Number(input.touristReports) || 0,
    lightingScore: input.lighting ?? null,
    crowdDensity: input.crowdDensity || 'NORMAL',
    transportAvailability: input.transportAvailability || 'MODERATE'
  };
}

export async function predictSafety(input, { nearbyEmergencyServices = [] } = {}) {
  const weighted = computeSafetyScore(input);
  const factors = riskFactors(weighted.breakdown);

  if (!mlConfigured()) {
    return {
      ...weighted,
      mlPrediction: null,
      mlConfidence: null,
      method: 'weighted_score',
      modelVersion: null,
      riskFactors: factors,
      nearbyEmergencyServices
    };
  }

  try {
    const res = await predict(MODEL, toMLPayload(input));
    const mlPrediction = normalizeLevel(res?.prediction || res?.safetyLevel || weighted.safetyLevel);
    const rawConf = Number(res?.confidence ?? res?.probability ?? NaN);
    const mlConfidence = Number.isFinite(rawConf) ? (rawConf > 1 ? rawConf / 100 : Math.max(0, Math.min(1, rawConf))) : null;

    return {
      ...weighted,
      safetyLevel: mlPrediction,
      mlPrediction,
      mlConfidence,
      confidence: mlConfidence ?? (weighted.safetyScore ? weighted.safetyScore / 100 : 0.85),
      method: 'random_forest',
      modelVersion: res?.modelVersion || res?.model_version || 'safety_model_v1',
      riskFactors: factors,
      nearbyEmergencyServices
    };
  } catch (err) {
    logger.warn('Safety ML prediction failed — using weighted score', { error: err.message });
    return {
      ...weighted,
      mlPrediction: null,
      mlConfidence: null,
      method: 'weighted_score',
      modelVersion: null,
      mlError: err.code || 'ML_UNAVAILABLE',
      riskFactors: factors,
      nearbyEmergencyServices
    };
  }
}

function normalizeLevel(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'HIGH_RISK' || v === 'HIGHRISK') return 'HIGH_RISK';
  if (v === 'SAFE' || v === 'VERY_SAFE' || v === 'VERYSAFE') return v === 'VERY_SAFE' || v === 'VERYSAFE' ? 'VERY_SAFE' : 'SAFE';
  return 'MODERATE';
}

export { levelForScore };
