import { api, loginTourist, loginAdmin, auth } from './helpers.js';

// --- Pure engines (unit tests) ----------------------------------------------
import { haversineKm, calculateDistance } from '../src/intelligence/geo/haversine.js';
import { astar, graphFromWaypoints } from '../src/intelligence/route/astRouter.js';
import { computeExpectedFare, classifyFare, overchargePercentage, evaluateFare } from '../src/intelligence/fare/fareEngine.js';
import { computeSafetyScore, levelForScore } from '../src/intelligence/safety/safetyScoreEngine.js';
import { rankCandidates } from '../src/intelligence/recommendation/recommendationEngine.js';
import { generatePackingPlan } from '../src/intelligence/packing/packingEngine.js';
import { optimizeItinerary } from '../src/intelligence/trip/itineraryOptimizer.js';

describe('Haversine (geo engine)', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(11.0, 76.0, 11.0, 76.0)).toBe(0);
  });
  it('computes a known approximate distance (Chennai → Coimbatore ~ 430 km)', () => {
    const d = haversineKm(13.0827, 80.2707, 11.0168, 76.9558);
    expect(d).toBeGreaterThan(400);
    expect(d).toBeLessThan(470);
  });
  it('returns meters + kilometers', () => {
    const r = calculateDistance(11.0, 76.0, 11.0, 76.01);
    expect(r.kilometers).toBeGreaterThan(0);
    expect(r.meters).toBe(Math.round(r.kilometers * 1000));
  });
  it('throws on invalid latitude', () => {
    expect(() => haversineKm(91, 76, 11, 76)).toThrow();
    expect(() => haversineKm(91, 76, 11, 76)).toThrow(/latitude/i);
  });
  it('throws on invalid longitude', () => {
    expect(() => haversineKm(11, 181, 11, 76)).toThrow(/longitude/i);
  });
});

describe('A* route optimizer', () => {
  const grid = {
    nodes: [
      { id: 'A', lat: 11.0, lon: 76.0 },
      { id: 'B', lat: 11.01, lon: 76.0 },
      { id: 'C', lat: 11.02, lon: 76.0 },
      { id: 'D', lat: 11.0, lon: 76.02 }
    ],
    edges: [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'A', to: 'D' },
      { from: 'D', to: 'C' }
    ]
  };

  it('finds a path from A to C', () => {
    const r = astar(grid, 'A', 'C');
    expect(r).toBeTruthy();
    expect(r.path[0]).toBe('A');
    expect(r.path[r.path.length - 1]).toBe('C');
    expect(r.steps.length).toBeGreaterThan(0);
    expect(r.geometry.type).toBe('LineString');
  });
  it('returns an empty route when start equals goal', () => {
    const r = astar(grid, 'A', 'A');
    expect(r.distanceKm).toBe(0);
    expect(r.path).toEqual(['A']);
  });
  it('returns null when no route exists', () => {
    const g = { nodes: [{ id: 'X', lat: 1, lon: 1 }, { id: 'Y', lat: 2, lon: 2 }], edges: [] };
    expect(astar(g, 'X', 'Y')).toBeNull();
  });
  it('builds a graph from waypoints', () => {
    const g = graphFromWaypoints([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, { lat: 3, lon: 3 }]);
    expect(g.nodes.length).toBe(3);
    expect(g.edges.length).toBe(3);
  });
});

describe('Fair fare engine (rule baseline)', () => {
  it('computes expected fare = base + distance*perKm + duration*perMin', () => {
    const e = computeExpectedFare({ vehicleType: 'auto', distanceKm: 8.2, durationMinutes: 25 });
    expect(e).toBe(30 + Math.round(8.2 * 12)); // auto: 30 base + 8.2*12, no per-minute
  });
  it('classifies FAIR / SLIGHTLY_HIGH / OVERCHARGED', () => {
    const expected = 200;
    expect(classifyFare(expected, 200)).toBe('FAIR');
    expect(classifyFare(expected, 240)).toBe('SLIGHTLY_HIGH');
    expect(classifyFare(expected, 300)).toBe('OVERCHARGED');
  });
  it('computes overcharge percentage (350 vs 180 → ~94%)', () => {
    const pct = overchargePercentage(180, 350);
    expect(pct).toBeGreaterThan(90);
    expect(pct).toBeLessThan(100);
  });
  it('evaluates the acceptance test case (auto 8.2km, ₹350 quote)', () => {
    const r = evaluateFare({ vehicleType: 'auto', distanceKm: 8.2, durationMinutes: 25, quotedFare: 350 });
    expect(r.status).toBe('OVERCHARGED');
    expect(r.riskLevel).toBe('high');
    expect(r.explanation.length).toBeGreaterThan(0);
    expect(r.method).toBe('rule_based');
  });
});

describe('Safety score engine (weighted)', () => {
  it('produces a safe score near a hospital/police with no incidents', () => {
    const r = computeSafetyScore({ policeDistanceKm: 0.3, hospitalDistanceKm: 0.4, fireStationDistanceKm: 0.5, incidentCount: 0, timeOfDay: 'DAY', lighting: 90, crowdDensity: 'NORMAL', transportAvailability: 'HIGH' });
    expect(r.safetyScore).toBeGreaterThanOrEqual(75);
    expect(['VERY_SAFE', 'SAFE']).toContain(r.safetyLevel);
  });
  it('produces a high-risk score with incidents + no emergency access at night', () => {
    const r = computeSafetyScore({ policeDistanceKm: 20, hospitalDistanceKm: 25, fireStationDistanceKm: 30, incidentCount: 40, touristReports: 10, timeOfDay: 'NIGHT', lighting: 20, crowdDensity: 'DESERTED', transportAvailability: 'LOW' });
    expect(r.safetyLevel).toBe('HIGH_RISK');
    expect(r.safetyScore).toBeLessThan(50);
  });
  it('maps score bands correctly', () => {
    expect(levelForScore(95)).toBe('VERY_SAFE');
    expect(levelForScore(80)).toBe('SAFE');
    expect(levelForScore(60)).toBe('MODERATE');
    expect(levelForScore(30)).toBe('HIGH_RISK');
  });
});

describe('Recommendation engine (weighted)', () => {
  const candidates = [
    { id: 'a', name: 'A', rating: 4.8, reviews: 2000, distanceKm: 2, price: 500, soloSuitability: 80, openingHours: 'Open' },
    { id: 'b', name: 'B', rating: 3.2, reviews: 50, distanceKm: 20, price: 5000, soloSuitability: 40, openingHours: 'Closed' }
  ];
  it('ranks a better-rated, closer, cheaper place higher', () => {
    const r = rankCandidates(candidates, { travelType: 'SOLO', budget: 1000 });
    expect(r.ranked[0].id).toBe('a');
    expect(r.ranked[0].score).toBeGreaterThan(r.ranked[1].score);
  });
  it('returns the expected buckets', () => {
    const r = rankCandidates(candidates, { travelType: 'SOLO', budget: 1000 });
    ['recommended', 'nearby', 'budgetFriendly', 'highlyRated', 'safe'].forEach((k) => expect(Array.isArray(r[k])).toBe(true));
  });
});

describe('Packing engine (context-aware)', () => {
  it('generates a day-wise list and removes duplicates', () => {
    const plan = generatePackingPlan({
      itinerary: [
        { day: 1, activities: [{ title: 'Marina Beach', category: 'Beach' }] },
        { day: 2, activities: [{ title: 'Kapaleeshwarar Temple', category: 'Temple' }] }
      ],
      durationDays: 2
    });
    expect(plan.length).toBe(2);
    // No duplicate items within a single day (generic essentials repeat across days).
    for (const d of plan) {
      const names = d.items.map((i) => i.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    }
    expect(plan[0].items.some((i) => i.name === 'Sunscreen')).toBe(true);
    expect(plan[1].items.some((i) => i.name === 'Comfortable clothing')).toBe(true);
  });
  it('assigns ESSENTIAL / RECOMMENDED / OPTIONAL priorities', () => {
    const plan = generatePackingPlan({ itinerary: [{ day: 1, activities: [{ title: 'Trek', category: 'Hiking' }] }] });
    const items = plan[0].items;
    expect(items.some((i) => i.priority === 'ESSENTIAL')).toBe(true);
    expect(items.every((i) => ['ESSENTIAL', 'RECOMMENDED', 'OPTIONAL'].includes(i.priority))).toBe(true);
  });
  it('handles rain weather context', () => {
    const plan = generatePackingPlan({ itinerary: [{ day: 1, activities: [] }], weather: { condition: 'Rain' }, durationDays: 1 });
    expect(plan[0].items.some((i) => i.name === 'Umbrella')).toBe(true);
  });
});

describe('Itinerary optimizer', () => {
  const places = [
    { id: 'p1', name: 'A', category: 'Temple', entryPrice: 'Free' },
    { id: 'p2', name: 'B', category: 'Park', entryPrice: '₹20' },
    { id: 'p3', name: 'C', category: 'Museum', entryPrice: '₹15' }
  ];
  it('distributes 3 places across 2 days and only schedules selected places', () => {
    const r = optimizeItinerary({ places, durationDays: 2 });
    expect(r.itinerary.length).toBe(2);
    const titles = r.itinerary.flatMap((d) => d.activities.filter((a) => a.type === 'Attraction').map((a) => a.title));
    expect(titles.sort()).toEqual(['A', 'B', 'C']);
  });
  it('adds generic activities when few places are selected', () => {
    const r = optimizeItinerary({ places: [places[0]], durationDays: 2 });
    expect(r.itinerary.length).toBe(2);
    // day 2 has no selected places -> generic fillers only
    const day2 = r.itinerary.find((d) => d.day === 2);
    expect(day2.activities.every((a) => a.type !== 'Attraction')).toBe(true);
  });
});

// --- API integration --------------------------------------------------------

describe('Intelligence API', () => {
  let tourist;

  beforeAll(async () => {
    tourist = await loginTourist();
  });

  it('POST /fare/predict returns a rule-based prediction (no ML service)', async () => {
    const res = await api().post('/api/intelligence/fare/predict').set(auth(tourist.accessToken)).send({
      vehicleType: 'AUTO', distanceKm: 8.2, durationMinutes: 25, timeOfDay: 'EVENING',
      dayOfWeek: 'SATURDAY', trafficLevel: 'NORMAL', weatherCondition: 'CLEAR', quotedFare: 350
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OVERCHARGED');
    expect(res.body.data.expectedFare).toBeGreaterThan(0);
    expect(res.body.data.explanation.length).toBeGreaterThan(0);
  });

  it('POST /safety/predict returns score + level + nearby services', async () => {
    const res = await api().post('/api/intelligence/safety/predict').set(auth(tourist.accessToken)).send({
      latitude: 11.0046, longitude: 76.9659, timeOfDay: 'NIGHT', dayOfWeek: 'SATURDAY'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.safetyScore).toBeGreaterThanOrEqual(0);
    expect(['VERY_SAFE', 'SAFE', 'MODERATE', 'HIGH_RISK']).toContain(res.body.data.safetyLevel);
    expect(Array.isArray(res.body.data.nearbyEmergencyServices)).toBe(true);
  });

  it('GET /recommendations ranks catalog places', async () => {
    const res = await api().get('/api/intelligence/recommendations?type=places&location=Coimbatore&travelType=FAMILY&budget=10000').set(auth(tourist.accessToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.ranked)).toBe(true);
    expect(res.body.data.ranked[0].score).toBeGreaterThanOrEqual(0);
  });

  it('GET /emergency/nearest returns real seeded services sorted by distance', async () => {
    const res = await api().get('/api/intelligence/emergency/nearest?latitude=11.0046&longitude=76.9659&type=HOSPITAL').set(auth(tourist.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.services.length).toBeGreaterThan(0);
    expect(res.body.data.services[0].distanceKm).toBeGreaterThanOrEqual(0);
    expect(res.body.data.services[0].estimatedTravelTime).toBeGreaterThan(0);
  });

  it('POST /route supports a custom graph via A*', async () => {
    const res = await api().post('/api/intelligence/route').set(auth(tourist.accessToken)).send({
      start: 'A', goal: 'C',
      graph: {
        nodes: [{ id: 'A', lat: 11, lon: 76 }, { id: 'B', lat: 11.01, lon: 76 }, { id: 'C', lat: 11.02, lon: 76 }],
        edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }]
      }
    });
    expect(res.status).toBe(200);
    expect(res.body.data.algorithm).toBe('astar');
    expect(res.body.data.path).toContain('C');
  });

  it('POST /packing returns a day-wise list', async () => {
    const res = await api().post('/api/intelligence/packing').set(auth(tourist.accessToken)).send({
      itinerary: [{ day: 1, activities: [{ title: 'Beach', category: 'Beach' }] }], durationDays: 1
    });
    expect(res.status).toBe(200);
    expect(res.body.data.days.length).toBe(1);
  });

  it('POST /trip/optimize orders selected places', async () => {
    const res = await api().post('/api/intelligence/trip/optimize').set(auth(tourist.accessToken)).send({
      places: [
        { id: 'a', name: 'A', category: 'Temple' },
        { id: 'b', name: 'B', category: 'Park' }
      ],
      durationDays: 1
    });
    expect(res.status).toBe(200);
    expect(res.body.data.itinerary[0].activities.some((a) => a.type === 'Attraction')).toBe(true);
  });

  it('records feedback against the authenticated user', async () => {
    const res = await api().post('/api/intelligence/feedback').set(auth(tourist.accessToken)).send({ type: 'FARE', rating: 5, useful: true });
    expect(res.status).toBe(201);
    expect(res.body.data.recorded).toBe(true);
  });

  it('requires auth for intelligence endpoints', async () => {
    const res = await api().post('/api/intelligence/fare/predict').send({ quotedFare: 100 });
    expect(res.status).toBe(401);
  });

  it('GET /models is admin-only', async () => {
    const denied = await api().get('/api/intelligence/models').set(auth(tourist.accessToken));
    expect(denied.status).toBe(403);
    const admin = await loginAdmin();
    const okRes = await api().get('/api/intelligence/models').set(auth(admin.accessToken));
    expect(okRes.status).toBe(200);
    expect(Array.isArray(okRes.body.data.models)).toBe(true);
  });
});
