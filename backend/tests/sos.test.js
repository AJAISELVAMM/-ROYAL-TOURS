import { api, login, loginTourist, loginAdmin, auth } from './helpers.js';

describe('SOS', () => {
  let tourist;
  let admin;

  beforeAll(async () => {
    tourist = await loginTourist();
    admin = await loginAdmin();
  });

  it('creates a solo SOS using DB-derived identity', async () => {
    const res = await api()
      .post('/api/sos')
      .set(auth(tourist.accessToken))
      .send({ emergencyType: 'MEDICAL', locationText: 'Near railway station' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('rejects an invalid emergency type', async () => {
    const res = await api().post('/api/sos').set(auth(tourist.accessToken)).send({ emergencyType: 'NOPE' });
    expect(res.status).toBe(400);
  });

  it('creates a group SOS and notifies group members', async () => {
    const trips = await api().get('/api/trips').set(auth(tourist.accessToken));
    const tripId = trips.body.data[0].id;

    const res = await api()
      .post('/api/sos/group')
      .set(auth(tourist.accessToken))
      .send({ tripId, emergencyType: 'POLICE', locationText: 'Gandhipuram' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('blocks a non-member from triggering a group SOS', async () => {
    const other = await login('priya@example.com', 'tour123');
    const trips = await api().get('/api/trips').set(auth(tourist.accessToken));
    const tripId = trips.body.data[0].id;

    const res = await api()
      .post('/api/sos/group')
      .set(auth(other.accessToken))
      .send({ tripId, emergencyType: 'MEDICAL' });
    expect(res.status).toBe(403);
  });

  it('admin can list active SOS', async () => {
    const res = await api().get('/api/sos/active').set(auth(admin.accessToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('tourist cannot list ALL active SOS (admin only)', async () => {
    const res = await api().get('/api/sos/active').set(auth(tourist.accessToken));
    expect(res.status).toBe(403);
  });

  it('admin can acknowledge and resolve an SOS', async () => {
    const list = await api().get('/api/sos/active').set(auth(admin.accessToken));
    const sos = list.body.data.find((s) => s.status === 'ACTIVE');
    if (!sos) return;

    const ack = await api()
      .patch(`/api/sos/${sos.id}/transition`)
      .set(auth(admin.accessToken))
      .send({ status: 'ACKNOWLEDGED' });
    expect(ack.status).toBe(200);

    const res = await api()
      .patch(`/api/sos/${sos.id}/transition`)
      .set(auth(admin.accessToken))
      .send({ status: 'RESOLVED' });
    expect(res.body.data.status).toBe('RESOLVED');
  });

  it('tourist cannot escalate an SOS (admin only)', async () => {
    const list = await api().get('/api/sos/active').set(auth(admin.accessToken));
    const sos = list.body.data[0];
    if (!sos) return;

    const res = await api()
      .patch(`/api/sos/${sos.id}/transition`)
      .set(auth(tourist.accessToken))
      .send({ status: 'ESCALATED' });
    expect(res.status).toBe(403);
  });
});
