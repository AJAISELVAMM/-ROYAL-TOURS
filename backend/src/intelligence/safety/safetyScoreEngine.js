// =============================================================================
// safetyScoreEngine.js — transparent weighted safety risk score (0–100).
//
// Builds explainable sub-scores from a location's context, then combines them
// with configurable weights. Output bands map to SAFE / MODERATE / HIGH_RISK.
//
// This is a DETERMINISTIC weighted-scoring algorithm (not automatically an ML
// model). It is the fallback when the Random Forest safety model is offline.
// =============================================================================

import config from '../config.js';

function clamp100(n) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 50));
}

// Proximity → 0–100 score (closer = safer). At `zeroKm` score = 100; falls to
// 0 at `farKm`.
function proximityScore(km, zeroKm = 0.5, farKm = 15) {
  if (km == null || !Number.isFinite(km)) return 50; // unknown → neutral
  const d = Math.max(0, km);
  return clamp100((1 - Math.min(1, (d - zeroKm) / (farKm - zeroKm))) * 100);
}

// Higher incident counts → lower safety score.
function incidentScore(count, per10 = 100) {
  const c = Math.max(0, Number(count) || 0);
  return clamp100(100 - Math.min(100, (c / per10) * 100));
}

function timeRiskScore(timeOfDay) {
  const t = String(timeOfDay || 'DAY').toUpperCase();
  if (t === 'NIGHT' || t === 'LATE_NIGHT') return 35;
  if (t === 'EVENING') return 65;
  return 85; // MORNING / DAY
}

function crowdSafetyScore(density) {
  const d = String(density || 'NORMAL').toUpperCase();
  if (d === 'DESERTED' || d === 'LOW') return 45;
  if (d === 'VERY_CROWDED') return 70; // pickpocket risk, but also witness presence
  return 85; // NORMAL / MODERATE
}

function transportScore(availability) {
  const a = String(availability || 'MODERATE').toUpperCase();
  if (a === 'NONE' || a === 'LOW') return 40;
  if (a === 'HIGH') return 90;
  return 70; // MODERATE
}

function lightingScore(raw) {
  if (raw == null || !Number.isFinite(raw)) return 50;
  return clamp100(raw);
}

// Compute the weighted safety score (0–100) plus an explainable breakdown.
export function computeSafetyScore(input = {}) {
  const {
    policeDistanceKm,
    hospitalDistanceKm,
    fireStationDistanceKm,
    emergencyResponseDistanceKm,
    incidentCount = 0,
    crimeReports = 0,
    touristReports = 0,
    lighting,
    crowdDensity,
    transportAvailability,
    timeOfDay
  } = input;

  const policeProximity = proximityScore(policeDistanceKm);
  const hospitalProximity = proximityScore(hospitalDistanceKm);
  const fireProximity = proximityScore(fireStationDistanceKm);
  const emergencyAccess = clamp100((policeProximity + hospitalProximity + fireProximity) / 3);
  const responseAccess = proximityScore(emergencyResponseDistanceKm, 1, 30);

  const totalIncidents = Number(incidentCount) + Number(crimeReports) + Number(touristReports);
  const incidentDensity = incidentScore(totalIncidents);
  const touristReportDensity = incidentScore(Number(touristReports) || 0, 20);

  const timeRisk = timeRiskScore(timeOfDay);
  const crowdSafety = crowdSafetyScore(crowdDensity);
  const transportAccess = transportScore(transportAvailability);
  const lightingS = lightingScore(lighting);

  const w = config.safetyWeights;
  const incidentHistory = clamp100((incidentDensity * 0.6 + touristReportDensity * 0.4));
  const emergencyAccessibility = clamp100((emergencyAccess * 0.6 + responseAccess * 0.4));

  const score = clamp100(
    incidentHistory * w.incidentHistory +
      emergencyAccessibility * w.emergencyAccess +
      policeProximity * w.policeProximity +
      hospitalProximity * w.hospitalProximity +
      lightingS * w.lighting +
      crowdSafety * w.crowd +
      transportAccess * w.transport +
      timeRisk * w.timeRisk
  );

  return {
    safetyScore: +score.toFixed(1),
    safetyLevel: levelForScore(score),
    breakdown: {
      incidentHistory: +incidentHistory.toFixed(1),
      emergencyAccessibility: +emergencyAccessibility.toFixed(1),
      policeProximity: +policeProximity.toFixed(1),
      hospitalProximity: +hospitalProximity.toFixed(1),
      fireProximity: +fireProximity.toFixed(1),
      lighting: +lightingS.toFixed(1),
      crowdSafety: +crowdSafety.toFixed(1),
      transportAccessibility: +transportAccess.toFixed(1),
      timeRisk: +timeRisk.toFixed(1)
    }
  };
}

export function levelForScore(score) {
  const { verySafeMin, safeMin, moderateMin } = config.safetyLevels;
  if (score >= verySafeMin) return 'VERY_SAFE';
  if (score >= safeMin) return 'SAFE';
  if (score >= moderateMin) return 'MODERATE';
  return 'HIGH_RISK';
}

// Explain the dominant risk factors (lowest sub-scores = highest risk).
export function riskFactors(breakdown, threshold = 65) {
  const labels = {
    incidentHistory: 'Reported incidents near this location',
    emergencyAccessibility: 'Limited emergency-service access',
    policeProximity: 'No police station nearby',
    hospitalProximity: 'No hospital nearby',
    fireProximity: 'No fire station nearby',
    lighting: 'Poor street lighting',
    crowdSafety: 'Deserted or isolated area',
    transportAccessibility: 'Limited transport options',
    timeRisk: 'Higher risk at this time of day'
  };
  return Object.entries(breakdown)
    .filter(([, v]) => v < threshold)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => labels[k] || k);
}
