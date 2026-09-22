import { api, loginTourist, loginAdmin, auth } from './helpers.js';

const uniq = Date.now();

async function pickPlaceIds() {
  const res = await api().get('/api/discover/places');
  return res.body.data.items.slice(0, 3).map((p) => p.id);
}

describe('Trips', () => {
  let tourist;
  let admin;

  beforeAll(async () => {
    tourist = await loginTourist();
    admin = await loginAdmin();
  });

  it('creates a trip with members, itinerary and packing', async () => {
    const [a, b, c] = await pickPlaceIds();
    const res = await api().post('/api/trips').set(auth(tourist.accessToken)).send({
      destination: 'Coimbatore',
      duration: '2 Days',
      durationDays: 2,
      budget: 10000,
      group: 'Friends',
      memberCount: 2,
      members: [
        { name: 'Arun', phone: `98${String(uniq).slice(-8)}` },
        { name: 'Kavi', phone: `97${String(uniq).slice(-8)}` }
      ],
      selectedPlaceIds: [a, b, c]
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();

    const trip = await api().get(`/api/trips/${res.body.data.id}`).set(auth(tourist.accessToken));
    expect(trip.status).toBe(200);
    expect(trip.body.data.members.length).toBe(2);
    expect(trip.body.data.places.length).toBe(3);
    expect(trip.body.data.itinerary.length).toBe(2);
    expect(trip.body.data.packing.length).toBe(2);
  });

  it('rejects a trip with no places', async () => {
    const res = await api().post('/api/trips').set(auth(tourist.accessToken)).send({
      destination: 'Coimbatore',
      duration: '1 Day',
      budget: 5000,
      group: 'Solo',
      members: [{ name: 'Arun', phone: `96${String(uniq).slice(-8)}` }],
      selectedPlaceIds: []
    });
    expect(res.status).toBe(400);
  });

  it('lists trips for the authenticated user only', async () => {
    const res = await api().get('/api/trips').set(auth(tourist.accessToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejects trip creation when unauthenticated', async () => {
    const res = await api().post('/api/trips').send({ destination: 'X' });
    expect(res.status).toBe(401);
  });

  it('admin overview returns aggregated counters', async () => {
    const res = await api().get('/api/admin/overview').set(auth(admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalUsers');
    expect(res.body.data).toHaveProperty('activeTrips');
  });

  it('persists expenses per trip and enforces trip ownership', async () => {
    const [a, b] = await pickPlaceIds();
    const createdTrip = await api().post('/api/trips').set(auth(tourist.accessToken)).send({
      destination: 'Chennai',
      duration: '3 Days',
      durationDays: 3,
      budget: 25000,
      group: 'Solo',
      memberCount: 1,
      members: [{ name: 'Arun', phone: `95${String(uniq + 1).slice(-8)}` }],
      selectedPlaceIds: [a, b]
    });
    expect(createdTrip.status).toBe(201);
    const tripId = createdTrip.body.data.id;

    const added = await api().post(`/api/trips/${tripId}/budget/expenses`).set(auth(tourist.accessToken)).send({
      category: 'Food',
      title: 'Dinner',
      amount: 750,
      date: '2026-09-20',
      description: 'Dinner at restaurant'
    });
    expect(added.status).toBe(201);
    expect(added.body.data.totalSpent).toBe(750);
    expect(added.body.data.remainingBudget).toBe(24250);
    const expenseId = added.body.data.expense.id;

    const forbidden = await api().get(`/api/trips/${tripId}/budget`).set(auth(admin.accessToken));
    expect(forbidden.status).toBe(403);

    const updated = await api().put(`/api/trips/${tripId}/budget/expenses/${expenseId}`).set(auth(tourist.accessToken)).send({
      category: 'Shopping',
      title: 'Souvenir',
      amount: 1000,
      date: '2026-09-21'
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.categoryTotals.Shopping).toBe(1000);

    const removed = await api().delete(`/api/trips/${tripId}/budget/expenses/${expenseId}`).set(auth(tourist.accessToken));
    expect(removed.status).toBe(200);
    expect(removed.body.data.totalSpent).toBe(0);
  });
});
