// =============================================================================
// intelligenceController.js — intelligence API surface.
//
//   POST /api/intelligence/fare/predict        (Random Forest + rule baseline)
//   POST /api/intelligence/safety/predict      (Random Forest + weighted score)
//   GET  /api/intelligence/recommendations     (weighted recommendation)
//   GET  /api/intelligence/emergency/nearest   (Haversine nearest services)
//   POST /api/intelligence/route               (A* / routing provider)
//   POST /api/intelligence/packing             (context-aware AI packing)
//   POST /api/intelligence/trip/optimize       (itinerary optimizer)
//   POST /api/intelligence/feedback            (feedback loop)
//   GET  /api/intelligence/models              (admin: model registry)
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';
import prisma from '../config/database.js';

import { predictFare } from '../intelligence/fare/farePredictionService.js';
import { evaluateFare } from '../intelligence/fare/fareEngine.js';
import { predictSafety } from '../intelligence/safety/safetyPredictionService.js';
import { computeSafetyScore } from '../intelligence/safety/safetyScoreEngine.js';
import { rankCandidates } from '../intelligence/recommendation/recommendationEngine.js';
import { findNearestServices, normalizeServiceType } from '../intelligence/geo/nearestService.js';
import { haversineKm } from '../intelligence/geo/haversine.js';
import { astar, graphFromWaypoints } from '../intelligence/route/astRouter.js';
import { generatePackingPlan } from '../intelligence/packing/packingEngine.js';
import { optimizeItinerary } from '../intelligence/trip/itineraryOptimizer.js';
import { getRoute } from '../providers/maps/routingProvider.js';
import { mlConfigured, health as mlHealth } from '../intelligence/ml/client.js';
import config from '../intelligence/config.js';

// --- Fare ----------------------------------------------------------------

export const farePredict = asyncHandler(async (req, res) => {
  const result = await predictFare(req.body || {});
  ok(res, result);
});

// --- Safety --------------------------------------------------------------

export const safetyPredict = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body || {};
  if (latitude == null || longitude == null) {
    throw badRequest('latitude and longitude are required.');
  }

  // Real emergency accessibility for this location (Haversine).
  const nearby = await findNearestServices(latitude, longitude, null, { allTypes: true, limit: 4 });

  // Feed the real nearest-service distances back into the weighted score so it
  // reflects actual accessibility (not neutral defaults).
  const nearestOf = (t) => nearby.find((s) => s.type === t)?.distanceKm ?? null;
  const distances = nearby.map((s) => s.distanceKm).filter((d) => d != null);
  const enriched = {
    ...(req.body || {}),
    policeDistanceKm: req.body?.policeDistanceKm ?? nearestOf('POLICE'),
    hospitalDistanceKm: req.body?.hospitalDistanceKm ?? nearestOf('HOSPITAL'),
    fireStationDistanceKm: req.body?.fireStationDistanceKm ?? nearestOf('FIRE_STATION'),
    emergencyResponseDistanceKm:
      req.body?.emergencyResponseDistanceKm ?? (distances.length ? Math.min(...distances) : null)
  };

  const result = await predictSafety(enriched, { nearbyEmergencyServices: nearby });
  ok(res, result);
});

// --- Recommendations -----------------------------------------------------

const PRICE_PARSER = {
  places: (p) => (p.entryPrice ? parsePrice(p.entryPrice) : null),
  hotels: (h) => h.pricePerNight ?? null,
  restaurants: (r) => parsePrice(r.priceRange),
  theatres: () => null,
  shopping: () => null
};

function parsePrice(s) {
  const nums = (String(s || '').match(/\d+/g) || []).map(Number).filter((n) => n > 0);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// Compute a location's safety score from its real distance to emergency
// services (all services fetched once, distances computed in memory).
async function safetyContextFor(items, allServices) {
  const map = new Map();
  for (const it of items) {
    if (it.latitude == null || it.longitude == null) {
      map.set(it.id, null);
      continue;
    }
    const dist = (t) => {
      const pool = allServices.filter((s) => s.type === t);
      if (pool.length === 0) return null;
      return Math.min(...pool.map((s) => haversineKm(it.latitude, it.longitude, s.latitude, s.longitude)));
    };
    map.set(it.id, {
      policeDistanceKm: dist('POLICE'),
      hospitalDistanceKm: dist('HOSPITAL'),
      fireStationDistanceKm: dist('FIRE_STATION')
    });
  }
  return map;
}

export const recommendations = asyncHandler(async (req, res) => {
  const { type = 'places', location, travelType = 'SOLO', budget = 0, limit = 30 } = req.query;
  const validTypes = ['places', 'hotels', 'restaurants', 'theatres', 'shopping'];
  if (!validTypes.includes(type)) throw badRequest('Invalid type. Use one of: places, hotels, restaurants, theatres, shopping.');

  const model = prisma[type === 'places' ? 'place' : type === 'hotels' ? 'hotel' : type === 'restaurants' ? 'restaurant' : type === 'theatres' ? 'theatre' : 'shopping'];
  const where = {};
  if (location) where.location = { contains: location, mode: 'insensitive' };
  const items = await model.findMany({ where, take: Number(limit) || 30 });

  const allServices = await prisma.emergencyService.findMany({ where: { active: true } });
  const safetyCtx = await safetyContextFor(items, allServices);

  const candidates = items.map((it) => {
    const ctx = safetyCtx.get(it.id);
    const safety = ctx ? computeSafetyScore({ ...ctx, timeOfDay: 'DAY' }).safetyScore : null;
    return {
      __type: type,
      id: it.id,
      name: it.name,
      category: it.category ?? it.cuisine ?? null,
      rating: it.rating,
      reviews: it.reviews ?? 0,
      distanceKm: it.distanceKm ?? null,
      latitude: it.latitude,
      longitude: it.longitude,
      price: PRICE_PARSER[type](it),
      safetyScore: safety,
      openingHours: it.openingHours ?? null
    };
  });

  const ranked = rankCandidates(candidates, { travelType, budget: Number(budget) || 0 });
  ok(res, { type, travelType, ...ranked });
});

// --- Nearest emergency ----------------------------------------------------

export const emergencyNearest = asyncHandler(async (req, res) => {
  const { latitude, longitude, type } = req.query;
  if (latitude == null || longitude == null) throw badRequest('latitude and longitude are required.');
  const services = await findNearestServices(latitude, longitude, type, { limit: 5 });
  ok(res, { type: normalizeServiceType(type) || null, services });
});

// --- Route ---------------------------------------------------------------

export const route = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Custom graph path-finding via A*.
  if (body.graph && body.graph.nodes) {
    const { start, goal } = body;
    if (!start || !goal) throw badRequest('start and goal node ids are required when a graph is provided.');
    const result = astar(body.graph, start, goal, body.options || {});
    if (!result) throw badRequest('No route exists between the given nodes.', 'NO_ROUTE');
    return ok(res, { algorithm: 'astar', ...result });
  }

  // Real routing via the configured provider.
  const { from, to, mode = 'driving-car' } = body;
  if (!from || !to) throw badRequest('from and to are required (or provide a graph + start + goal).');
  const result = await getRoute({ from, to, mode });
  ok(res, { algorithm: 'routing_provider', ...result });
});

// --- Packing -------------------------------------------------------------

export const packing = asyncHandler(async (req, res) => {
  const plan = generatePackingPlan(req.body || {});
  ok(res, { days: plan, method: 'context_rules' });
});

// --- Trip optimize -------------------------------------------------------

export const tripOptimize = asyncHandler(async (req, res) => {
  const { places, durationDays, travelType, startLat, startLon } = req.body || {};
  if (!Array.isArray(places) || places.length === 0) throw badRequest('places[] is required.');
  const result = optimizeItinerary({ places, durationDays, travelType, startLat, startLon });
  ok(res, { ...result, method: 'nearest_neighbour_ordering' });
});

// --- Feedback loop -------------------------------------------------------

export const feedback = asyncHandler(async (req, res) => {
  const { type, refId, rating, useful, comment } = req.body || {};
  const valid = ['FARE', 'RECOMMENDATION', 'SAFETY', 'PACKING', 'ROUTE'];
  if (!valid.includes(type)) throw badRequest('Invalid feedback type.');
  const fb = await prisma.intelligenceFeedback.create({
    data: {
      userId: req.user.id,
      type,
      refId: refId || null,
      rating: rating != null ? Number(rating) : null,
      useful: useful != null ? !!useful : null,
      comment: comment || null
    }
  });
  ok(res, { id: fb.id, recorded: true }, 201);
});

// --- Model registry (admin) ----------------------------------------------

export const models = asyncHandler(async (_req, res) => {
  const [models, ml] = await Promise.all([
    prisma.intelligenceModel.findMany({ orderBy: { createdAt: 'desc' } }),
    mlHealth()
  ]);
  ok(res, {
    mlService: ml.configured ? { configured: true, healthy: ml.healthy } : { configured: false },
    models: models.map((m) => ({
      key: m.key,
      kind: m.kind,
      version: m.version,
      trainingDate: m.trainingDate,
      datasetVersion: m.datasetVersion,
      datasetSource: m.datasetSource,
      features: safeJson(m.features),
      hyperparameters: safeJson(m.hyperparameters),
      metrics: safeJson(m.metrics),
      featureImportance: safeJson(m.featureImportance),
      status: m.status
    }))
  });
});

function safeJson(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Expose for potential reuse.
export { evaluateFare, computeSafetyScore, mlConfigured, config };
