// =============================================================================
// recommendationEngine.js — weighted place recommendation.
//
// Each candidate is scored 0–100 as a weighted sum of normalized factors:
//   rating · safety · distance · budget · travelType suitability · opening.
// Weights are configurable (intelligence/config.js). Travel type (SOLO / COUPLE
// / FAMILY / FRIENDS) applies transparent bonuses/penalties — it never removes
// candidates, only re-ranks them.
//
// This is a DETERMINISTIC weighted-scoring algorithm (not automatically an ML
// model); it is labelled as such everywhere.
// =============================================================================

import config from '../config.js';

const TRAVEL_TYPES = ['SOLO', 'COUPLE', 'FAMILY', 'FRIENDS'];

// Category → which suitability tags the candidate exposes (best-effort).
// Suitability scores (0–100) come from the candidate's own data; missing ones
// default to a neutral 50 (explicitly NOT fabricated).
const NEUTRAL_SUITABILITY = 50;

function clamp01(n) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}
function clamp100(n) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 100));
}

// Normalize a rating (0–5) into 0–100.
function ratingScore(rating) {
  return clamp100((Number(rating) || 0) * 20);
}

// Normalize a review count logarithmically into 0–100 (diminishing returns).
function reviewScore(reviews) {
  const r = Math.max(0, Number(reviews) || 0);
  return clamp100(Math.min(100, 30 * Math.log10(r + 1) + (r > 0 ? 15 : 0)));
}

// Distance: nearer is better. 0 km → 100, falling to 0 at maxDistanceKm.
function distanceScore(distanceKm, maxDistanceKm = 30) {
  const d = Math.max(0, Number(distanceKm) || 0);
  return clamp100((1 - Math.min(1, d / maxDistanceKm)) * 100);
}

// Budget fit: how close the candidate's price is to the user's budget.
// 0 = perfect/under budget; penalizes over-budget and very cheap (mismatch).
function budgetScore(price, budget) {
  if (price == null || price <= 0) return 60; // unknown price → neutral
  const b = Math.max(0, Number(budget) || 0);
  if (b <= 0) return 60;
  const ratio = price / b;
  if (ratio <= 1) return clamp100(100 - ratio * 30); // under budget, slight taper
  return clamp100(Math.max(0, 100 - (ratio - 1) * 150)); // over budget penalty
}

// Travel-type suitability: pick the candidate's tag for the user's travel type.
function suitabilityScore(candidate, travelType) {
  const key = {
    SOLO: 'soloSuitability',
    COUPLE: 'coupleSuitability',
    FAMILY: 'familySuitability',
    FRIENDS: 'friendsSuitability'
  }[travelType];
  const v = candidate[key];
  return clamp100(v != null ? Number(v) : NEUTRAL_SUITABILITY);
}

// Travel-type adjustment: transparent bonus/penalty applied to the final score.
function travelTypeAdjustment(candidate, travelType) {
  const cat = String(candidate.category || candidate.cuisine || '').toLowerCase();
  const name = String(candidate.name || '').toLowerCase();
  const isFamilyFriendly = /park|zoo|museum|temple|beach/.test(cat + name);
  const isAdventure = /trek|hill|forest|waterfall|adventure/.test(cat + name);
  const isRomantic = /resort|view|beach|dinner|fine/.test(cat + name);
  const isEntertainment = /mall|shopping|theatre|cinema|arcade/.test(cat + name);

  let adj = 0;
  if (travelType === 'FAMILY' && isFamilyFriendly) adj += 6;
  if (travelType === 'FAMILY' && isAdventure) adj -= 2;
  if (travelType === 'COUPLE' && isRomantic) adj += 6;
  if (travelType === 'SOLO' && isAdventure) adj += 4;
  if (travelType === 'FRIENDS' && isEntertainment) adj += 6;
  return adj;
}

function openingScore(candidate) {
  const h = String(candidate.openingHours || candidate.openStatus || '').toLowerCase();
  if (!h) return 50; // unknown → neutral
  if (/closed/.test(h)) return 0;
  if (/24|always|open/.test(h)) return 100;
  return 70; // has hours but not currently checked
}

// Score one candidate and return an explained breakdown.
export function scoreCandidate(candidate, { travelType = 'SOLO', budget = 0, maxDistanceKm = 30, safetyScore = null } = {}) {
  const type = TRAVEL_TYPES.includes(travelType) ? travelType : 'SOLO';

  const rating = ratingScore(candidate.rating);
  const reviews = reviewScore(candidate.reviews);
  const safety = clamp100(safetyScore != null ? safetyScore : candidate.safetyScore != null ? candidate.safetyScore : 70);
  const distance = distanceScore(candidate.distanceKm, maxDistanceKm);
  const budgetFit = budgetScore(candidate.priceLevel ?? candidate.pricePerNight ?? candidate.price, budget);
  const suitability = suitabilityScore(candidate, type);
  const opening = openingScore(candidate);

  const w = config.recommendationWeights;
  let score = rating * w.rating + safety * w.safety + distance * w.distance + budgetFit * w.budget + suitability * w.travelType + opening * w.openingStatus;
  score = clamp100(score + travelTypeAdjustment(candidate, type));

  return {
    id: candidate.id,
    name: candidate.name,
    type: candidate.type || candidate.__type || 'place',
    score: +score.toFixed(1),
    rating: Number(candidate.rating) || 0,
    reviews: Number(candidate.reviews) || 0,
    distanceKm: candidate.distanceKm != null ? Number(candidate.distanceKm) : null,
    price: candidate.price ?? candidate.pricePerNight ?? candidate.priceLevel ?? null,
    breakdown: {
      rating: +rating.toFixed(1),
      reviews: +reviews.toFixed(1),
      safety: +safety.toFixed(1),
      distance: +distance.toFixed(1),
      budget: +budgetFit.toFixed(1),
      suitability: +suitability.toFixed(1),
      opening: +opening.toFixed(1)
    },
    travelTypeBonus: travelTypeAdjustment(candidate, type)
  };
}

// Rank a list of candidates, returning them grouped into the buckets the
// Discover UI expects (recommended / nearby / budget / highly rated / safe).
export function rankCandidates(candidates, options = {}) {
  const scored = (candidates || [])
    .map((c) => scoreCandidate(c, options))
    .sort((a, b) => b.score - a.score);

  return {
    ranked: scored,
    recommended: scored.slice(0, 10),
    nearby: scored
      .filter((s) => s.distanceKm != null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 10),
    budgetFriendly: scored
      .filter((s) => s.price != null)
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
      .slice(0, 10),
    highlyRated: [...scored].sort((a, b) => b.rating - a.rating).slice(0, 10),
    safe: [...scored].sort((a, b) => b.breakdown.safety - a.breakdown.safety).slice(0, 10)
  };
}
