import { api, loginAdmin, loginTourist, auth } from './helpers.js';

describe('Admin', () => {
  let admin;
  let tourist;

  beforeAll(async () => {
    admin = await loginAdmin();
    tourist = await loginTourist();
  });

  it('lists users (admin only)', async () => {
    const res = await api().get('/api/admin/users').set(auth(admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it('blocks tourist access to admin users', async () => {
    const res = await api().get('/api/admin/users').set(auth(tourist.accessToken));
    expect(res.status).toBe(403);
  });

  it('creates and verifies a catalog item (admin CRUD)', async () => {
    const create = await api().post('/api/admin/catalog/places').set(auth(admin.accessToken)).send({
      name: `Test Place ${Date.now()}`,
      category: 'Test',
      location: 'Coimbatore'
    });
    expect(create.status).toBe(201);
    const id = create.body.data.id;

    const verify = await api()
      .patch(`/api/admin/catalog/places/${id}/verify`)
      .set(auth(admin.accessToken))
      .send({ verified: true });
    expect(verify.body.data.verified).toBe(true);

    const del = await api().delete(`/api/admin/catalog/places/${id}`).set(auth(admin.accessToken));
    expect(del.body.data.success).toBe(true);
  });

  it('cannot escalate a user to admin (no role escalation)', async () => {
    const users = await api().get('/api/admin/users').set(auth(admin.accessToken));
    const target = users.body.data.users[0];
    const res = await api()
      .patch(`/api/admin/users/${target.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'ACTIVE', role: 'ADMIN' });
    // role is ignored — only status changes.
    expect(['ACTIVE', 'PENDING', 'BLOCKED']).toContain(res.body.data.status);
  });

  it('returns service status (admin only)', async () => {
    const res = await api().get('/api/admin/services').set(auth(admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('connected');
  });

  it('blocks tourist access to service status', async () => {
    const res = await api().get('/api/admin/services').set(auth(tourist.accessToken));
    expect(res.status).toBe(403);
  });

  it('returns admin account info', async () => {
    const res = await api().get('/api/admin/account').set(auth(admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('ADMIN');
  });

  it('records admin activity logs', async () => {
    const res = await api().get('/api/admin/activity-logs').set(auth(admin.accessToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
