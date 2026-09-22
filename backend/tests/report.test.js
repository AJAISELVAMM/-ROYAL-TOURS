import { api, loginTourist, loginAdmin, auth } from './helpers.js';

describe('Reports', () => {
  let tourist;
  let admin;

  beforeAll(async () => {
    tourist = await loginTourist();
    admin = await loginAdmin();
  });

  it('creates a report with identity derived from JWT', async () => {
    const res = await api().post('/api/reports').set(auth(tourist.accessToken)).send({
      category: 'FARE',
      location: 'Gandhipuram',
      description: 'Auto driver overcharged',
      expectedPrice: 100,
      chargedPrice: 250
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('UNDER_REVIEW');
  });

  it('rejects a report with an invalid category', async () => {
    const res = await api().post('/api/reports').set(auth(tourist.accessToken)).send({
      category: 'BOGUS',
      location: 'X',
      description: 'Y'
    });
    expect(res.status).toBe(400);
  });

  it('lists the tourist\'s own reports', async () => {
    const res = await api().get('/api/reports/mine').set(auth(tourist.accessToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('admin can list and update report status', async () => {
    const list = await api().get('/api/reports').set(auth(admin.accessToken));
    expect(list.status).toBe(200);
    const report = list.body.data[0];
    if (!report) return;

    const res = await api()
      .patch(`/api/reports/${report.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'RESOLVED' });
    expect(res.body.data.status).toBe('RESOLVED');
  });

  it('tourist cannot access the admin report list', async () => {
    const res = await api().get('/api/reports').set(auth(tourist.accessToken));
    expect(res.status).toBe(403);
  });
});
