// =============================================================================
// fareEngine.js — transparent rule-based fair-fare baseline + verdict.
//
// expectedFare = (baseFare + distanceKm*perKmRate + durationMinutes*perMinuteRate)
//                * surgeMultiplier
//
// Thresholds come from intelligence/config.js (configurable, never hardcoded).
// This engine is the deterministic fallback when the Random Forest model is
// unavailable; both share the same output contract (see buildFareResult).
// =============================================================================

import config from '../config.js';

// Compute the baseline (expected) fare for a vehicle type.
export function computeExpectedFare({ vehicleType, distanceKm, durationMinutes, baseFare, perKmRate, perMinuteRate, surgeMultiplier = 1 }) {
  const v = config.vehicleFares[normalizeVehicle(vehicleType)] || config.vehicleFares.auto;
  const base = baseFare != null ? Number(baseFare) : v.baseFare;
  const perKm = perKmRate != null ? Number(perKmRate) : v.perKmRate;
  const perMin = perMinuteRate != null ? Number(perMinuteRate) : v.perMinuteRate;
  const distance = Math.max(0, Number(distanceKm) || 0);
  const duration = Math.max(0, Number(durationMinutes) || 0);
  const surge = surgeMultiplier != null && Number(surgeMultiplier) > 0 ? Number(surgeMultiplier) : 1;

  const raw = (base + distance * perKm + duration * perMin) * surge;
  const expected = Math.max(v.minimum, Math.round(raw));
  return expected;
}

// Classify a quoted fare against the expected baseline.
export function classifyFare(expectedFare, quotedFare) {
  const expected = Number(expectedFare);
  const quoted = Number(quotedFare);
  if (!Number.isFinite(quoted) || quoted <= 0) return 'FAIR';

  const { fairMaxRatio, highMinRatio } = config.fareThresholds;
  if (quoted > expected * highMinRatio) return 'OVERCHARGED';
  if (quoted > expected * fairMaxRatio) return 'SLIGHTLY_HIGH';
  return 'FAIR';
}

export function overchargePercentage(expectedFare, quotedFare) {
  const expected = Number(expectedFare);
  const quoted = Number(quotedFare);
  if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(quoted) || quoted <= 0) return 0;
  return +(((quoted - expected) / expected) * 100).toFixed(1);
}

function normalizeVehicle(v) {
  const s = String(v || 'auto').toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('bike') || s.includes('moto')) return 'bike_taxi';
  if (s.includes('cab') || s.includes('taxi') || s.includes('car')) return 'taxi';
  if (s === 'rickshaw' || s.includes('erickshaw') || s.includes('cycle')) return 'rickshaw';
  if (s.includes('bus')) return 'bus';
  return 'auto';
}

// Produce a human explanation for the rule-based verdict.
export function explainFare(expectedFare, quotedFare, status, { vehicleType, distanceKm, durationMinutes } = {}) {
  const pct = overchargePercentage(expectedFare, quotedFare);
  const reasons = [];
  if (status === 'OVERCHARGED') {
    reasons.push(`Quoted fare (₹${quotedFare}) is ${pct}% above the estimated baseline (₹${expectedFare}).`);
    reasons.push('The quoted price is well above the typical rate for this route.');
  } else if (status === 'SLIGHTLY_HIGH') {
    reasons.push(`Quoted fare (₹${quotedFare}) is ${pct}% above the estimated baseline (₹${expectedFare}).`);
    reasons.push('Slightly above the usual range — consider negotiating or checking another vehicle.');
  } else {
    reasons.push(`Quoted fare (₹${quotedFare}) is within the expected range (baseline ₹${expectedFare}).`);
    reasons.push('The quoted price looks reasonable for this route.');
  }
  if (distanceKm != null) reasons.push(`Route distance ~${distanceKm} km${durationMinutes != null ? `, ~${durationMinutes} min` : ''}.`);
  return reasons;
}

// Rule-based confidence — derived transparently from how far the quoted fare
// sits from the decision thresholds (never a fabricated ML probability).
export function ruleConfidence(expectedFare, quotedFare, status) {
  const pct = Math.abs(overchargePercentage(expectedFare, quotedFare));
  const { fairMaxRatio, highMinRatio } = config.fareThresholds;
  if (status === 'FAIR') {
    // Confidence grows as the quote stays comfortably under the fair cap.
    return +Math.min(0.95, 0.55 + Math.max(0, (fairMaxRatio - 1) * 100 - pct) / 10).toFixed(2);
  }
  const band = (highMinRatio - fairMaxRatio) * 100; // width of the "slightly high" band
  if (status === 'SLIGHTLY_HIGH') {
    const into = pct - (fairMaxRatio - 1) * 100; // how deep into the band
    return +Math.min(0.9, 0.55 + (into / Math.max(band, 1)) * 0.35).toFixed(2);
  }
  // OVERCHARGED
  const beyond = pct - (highMinRatio - 1) * 100;
  return +Math.min(0.98, 0.75 + beyond / 50).toFixed(2);
}

// Single entry point: full fare result (shared output contract).
export function evaluateFare(input) {
  const { quotedFare, vehicleType, distanceKm, durationMinutes, baseFare, perKmRate, perMinuteRate, surgeMultiplier } = input || {};
  const v = config.vehicleFares[normalizeVehicle(vehicleType)] || config.vehicleFares.auto;
  const base = baseFare != null ? Number(baseFare) : v.baseFare;
  const perKm = perKmRate != null ? Number(perKmRate) : v.perKmRate;
  const perMin = perMinuteRate != null ? Number(perMinuteRate) : v.perMinuteRate;
  const distance = Math.max(0, Number(distanceKm) || 0);
  const duration = Math.max(0, Number(durationMinutes) || 0);
  const surge = surgeMultiplier != null && Number(surgeMultiplier) > 0 ? Number(surgeMultiplier) : 1;

  const distanceFare = distance * perKm;
  const durationFare = duration * perMin;
  const raw = (base + distanceFare + durationFare) * surge;
  const expectedFare = Math.max(v.minimum, Math.round(raw));

  const status = classifyFare(expectedFare, quotedFare);
  const pct = overchargePercentage(expectedFare, quotedFare);
  const riskLevel = status === 'OVERCHARGED' ? 'high' : status === 'SLIGHTLY_HIGH' ? 'medium' : 'low';

  return {
    status,
    confidence: ruleConfidence(expectedFare, quotedFare, status),
    expectedFare,
    estimatedFare: expectedFare,
    fairFare: expectedFare,
    quotedFare: Number(quotedFare) || null,
    distanceKm: distance,
    durationMinutes: duration,
    breakdown: {
      baseFare: base,
      perKmRate: perKm,
      distanceFare: Math.round(distanceFare),
      durationFare: Math.round(durationFare),
      surgeMultiplier: surge,
      total: expectedFare
    },
    overchargePercentage: pct,
    riskLevel,
    explanation: explainFare(expectedFare, Number(quotedFare), status, { vehicleType, distanceKm: distance, durationMinutes: duration }),
    method: 'rule_based'
  };
}
