import { api } from './helpers.js';

describe('Safety', () => {
  it('returns the safety map with markers', async () => {
    const res = await api().get('/api/safety/map');
    expect(res.status).toBe(200);
    expect(res.body.data.markers.length).toBeGreaterThan(0);
  });

  it('provides lost-tourist guidance with a route', async () => {
    const res = await api().post('/api/safety/guide').send({
      currentLatitude: 11.0046,
      currentLongitude: 76.9659,
      destinationType: 'HOSPITAL'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.destination.name).toBeTruthy();
    expect(res.body.data.route.steps.length).toBeGreaterThan(0);
  });

  it('rejects guidance without a location', async () => {
    const res = await api().post('/api/safety/guide').send({ destinationType: 'HOSPITAL' });
    expect(res.status).toBe(400);
  });

  it('returns the nearest emergency facility', async () => {
    const res = await api().get('/api/emergency/nearest?latitude=11.0046&longitude=76.9659&type=PHARMACY');
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('PHARMACY');
    expect(res.body.data.distanceKm).toBeGreaterThanOrEqual(0);
  });

  it('rejects nearest lookup without coordinates', async () => {
    const res = await api().get('/api/emergency/nearest?type=HOSPITAL');
    expect(res.status).toBe(400);
  });
});
