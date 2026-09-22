import { api, loginTourist, loginAdmin, auth } from './helpers.js';

describe('Location & Weather Endpoints', () => {
  let tourist;
  let admin;

  beforeAll(async () => {
    tourist = await loginTourist();
    admin = await loginAdmin();
  });

  describe('Live Weather API', () => {
    it('returns real atmospheric metrics for valid coordinates', async () => {
      const res = await api().get('/api/weather?latitude=11.0168&longitude=76.9558');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.temperature).toBeDefined();
      expect(res.body.data.humidity).toBeDefined();
      expect(res.body.data.condition).toBeDefined();
      expect(Array.isArray(res.body.data.forecast)).toBe(true);
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    });

    it('rejects weather request without coordinates', async () => {
      const res = await api().get('/api/weather');
      expect(res.status).toBe(400);
    });

    it('rejects weather request with invalid out-of-bounds coordinates', async () => {
      const res = await api().get('/api/weather?latitude=105.0&longitude=76.9558');
      expect(res.status).toBe(400);
    });
  });

  describe('Live Location Tracking API', () => {
    it('updates current location with valid coordinates', async () => {
      const res = await api()
        .post('/api/location/update')
        .set(auth(tourist.accessToken))
        .send({
          latitude: 11.0168,
          longitude: 76.9558,
          accuracy: 8.5,
          heading: 120,
          speed: 4.2
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.latitude).toBe(11.0168);
      expect(res.body.data.longitude).toBe(76.9558);
      expect(res.body.data.accuracy).toBe(8.5);
    });

    it('rejects location update with invalid latitude > 90', async () => {
      const res = await api()
        .post('/api/location/update')
        .set(auth(tourist.accessToken))
        .send({
          latitude: 95.0,
          longitude: 76.9558
        });

      expect(res.status).toBe(400);
    });

    it('rejects location update with invalid longitude < -180', async () => {
      const res = await api()
        .post('/api/location/update')
        .set(auth(tourist.accessToken))
        .send({
          latitude: 11.0168,
          longitude: -185.0
        });

      expect(res.status).toBe(400);
    });

    it('retrieves current tourist live location', async () => {
      const res = await api()
        .get('/api/location/current')
        .set(auth(tourist.accessToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.latitude).toBe(11.0168);
      expect(res.body.data.longitude).toBe(76.9558);
    });

    it('retrieves tourist location history', async () => {
      const res = await api()
        .get('/api/location/history')
        .set(auth(tourist.accessToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('rejects unauthenticated location update', async () => {
      const res = await api()
        .post('/api/location/update')
        .send({ latitude: 11.0168, longitude: 76.9558 });

      expect(res.status).toBe(401);
    });
  });
});
