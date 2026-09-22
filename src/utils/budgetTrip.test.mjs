import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveBudgetTrip,
  getDurationDays,
  getActiveMemberCount,
  buildBudgetAllocation
} from './budgetTrip.js';

test('resolveBudgetTrip prefers the selected trip when available', () => {
  const trips = [
    { id: 'trip-a', budget: 5000, status: 'active', startDate: '2026-09-10', endDate: '2026-09-11', members: [{ userId: 'u1', memberStatus: 'ACCEPTED' }, { userId: 'u2', memberStatus: 'ACCEPTED' }] },
    { id: 'trip-b', budget: 15000, status: 'active', startDate: '2026-09-10', endDate: '2026-09-15', members: [{ userId: 'u1', memberStatus: 'ACCEPTED' }, { userId: 'u2', memberStatus: 'ACCEPTED' }, { userId: 'u3', memberStatus: 'LEFT' }] }
  ];

  const trip = resolveBudgetTrip(trips, 'trip-b');
  assert.equal(trip.id, 'trip-b');
  assert.equal(trip.budget, 15000);
});

test('resolveBudgetTrip does not silently select the first trip', () => {
  assert.equal(resolveBudgetTrip([{ id: 'trip-a', budget: 5000 }], null), null);
});

test('getDurationDays counts inclusive dates correctly', () => {
  assert.equal(getDurationDays({ startDate: '2026-09-10', endDate: '2026-09-11' }), 2);
  assert.equal(getDurationDays({ startDate: '2026-09-10', endDate: '2026-09-13' }), 4);
});

test('getActiveMemberCount excludes left members', () => {
  const trip = {
    members: [
      { userId: 'u1', memberStatus: 'ACCEPTED' },
      { userId: 'u2', memberStatus: 'LEFT' },
      { userId: 'u3', status: 'INACTIVE' },
      { userId: 'u4', memberStatus: 'ACCEPTED' }
    ]
  };

  assert.equal(getActiveMemberCount(trip), 2);
});

test('buildBudgetAllocation preserves total budget when no expenses exist', () => {
  const allocation = buildBudgetAllocation({ budgetBreakdown: {} }, 5000, 2, 2);
  assert.equal(Object.values(allocation).reduce((sum, value) => sum + Number(value), 0), 5000);
  assert.equal(allocation.hotel, 1800);
  assert.equal(allocation.food, 1200);
  assert.equal(allocation.transport, 900);
  assert.equal(allocation.entertainment, 500);
  assert.equal(allocation.attractions, 600);
});

test('Trip A (₹5,000, 2 days, 2 members) calculations match specification', () => {
  const tripA = { id: 'trip-a', budget: 5000, durationDays: 2, memberCount: 2 };
  const days = getDurationDays(tripA);
  const members = getActiveMemberCount(tripA);
  const dailyPerMember = tripA.budget / (days * members);
  const allocation = buildBudgetAllocation(tripA, tripA.budget, days, members);

  assert.equal(days, 2);
  assert.equal(members, 2);
  assert.equal(dailyPerMember, 1250);
  assert.equal(allocation.hotel, 1800);
  assert.equal(allocation.food, 1200);
  assert.equal(allocation.transport, 900);
  assert.equal(allocation.entertainment, 500);
  assert.equal(allocation.attractions, 600);
  assert.equal(Object.values(allocation).reduce((a, b) => a + b, 0), 5000);
});

test('Trip B (₹10,000, 5 days, 2 members) calculations match specification', () => {
  const tripB = { id: 'trip-b', budget: 10000, durationDays: 5, memberCount: 2 };
  const days = getDurationDays(tripB);
  const members = getActiveMemberCount(tripB);
  const dailyPerMember = tripB.budget / (days * members);
  const allocation = buildBudgetAllocation(tripB, tripB.budget, days, members);

  assert.equal(days, 5);
  assert.equal(members, 2);
  assert.equal(dailyPerMember, 1000);
  assert.equal(allocation.hotel, 3600);
  assert.equal(allocation.food, 2400);
  assert.equal(allocation.transport, 1800);
  assert.equal(allocation.entertainment, 1000);
  assert.equal(allocation.attractions, 1200);
  assert.equal(Object.values(allocation).reduce((a, b) => a + b, 0), 10000);
});

test('Trip C (₹25,000, 3 days, 4 members) calculations match specification', () => {
  const tripC = { id: 'trip-c', budget: 25000, durationDays: 3, memberCount: 4 };
  const days = getDurationDays(tripC);
  const members = getActiveMemberCount(tripC);
  const dailyPerMember = Number((tripC.budget / (days * members)).toFixed(2));
  const allocation = buildBudgetAllocation(tripC, tripC.budget, days, members);

  assert.equal(days, 3);
  assert.equal(members, 4);
  assert.equal(dailyPerMember, 2083.33);
  assert.equal(allocation.hotel, 9000);
  assert.equal(allocation.food, 6000);
  assert.equal(allocation.transport, 4500);
  assert.equal(allocation.entertainment, 2500);
  assert.equal(allocation.attractions, 3000);
  assert.equal(Object.values(allocation).reduce((a, b) => a + b, 0), 25000);
});

test('Dynamic trip switching resolves exactly the chosen trip without state bleed', () => {
  const trips = [
    { id: 'trip-a', budget: 5000, durationDays: 2, memberCount: 2 },
    { id: 'trip-b', budget: 10000, durationDays: 5, memberCount: 2 },
    { id: 'trip-c', budget: 25000, durationDays: 3, memberCount: 4 }
  ];

  let selected = resolveBudgetTrip(trips, 'trip-a');
  assert.equal(selected.id, 'trip-a');
  assert.equal(selected.budget, 5000);

  selected = resolveBudgetTrip(trips, 'trip-b');
  assert.equal(selected.id, 'trip-b');
  assert.equal(selected.budget, 10000);

  selected = resolveBudgetTrip(trips, 'trip-c');
  assert.equal(selected.id, 'trip-c');
  assert.equal(selected.budget, 25000);

  selected = resolveBudgetTrip(trips, null);
  assert.equal(selected, null);
});
