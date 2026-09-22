import { api, loginTourist, loginAdmin, auth } from './helpers.js';

const uniq = Date.now();

describe('Auth', () => {
  describe('health', () => {
    it('returns healthy without auth', async () => {
      const res = await api().get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  describe('registration (tourist only)', () => {
    const phone = `9${String(uniq).slice(-9)}`;
    const email = `user${uniq}@example.com`;

    it('requests OTP and returns a dev code in mock mode', async () => {
      const res = await api().post('/api/auth/register/request-otp').send({
        name: 'Test User',
        email,
        phone,
        password: 'secret123'
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.devOtp).toBeDefined();
    });

    it('rejects registration with a wrong OTP', async () => {
      const res = await api().post('/api/auth/register/verify-otp').send({
        name: 'Test User',
        email,
        phone,
        password: 'secret123',
        otp: '000000'
      });
      expect(res.status).toBe(400);
    });

    it('completes registration with the correct OTP', async () => {
      const req = await api().post('/api/auth/register/request-otp').send({
        name: 'Test User',
        email: `user2${uniq}@example.com`,
        phone: `8${String(uniq).slice(-9)}`,
        password: 'secret123'
      });
      const otp = req.body.data.devOtp;
      const res = await api().post('/api/auth/register/verify-otp').send({
        name: 'Test User',
        email: `user2${uniq}@example.com`,
        phone: `8${String(uniq).slice(-9)}`,
        password: 'secret123',
        otp
      });
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('TOURIST');
      expect(res.body.data.user.phoneVerified).toBe(true);
    });

    it('cannot register an admin through the public endpoint', async () => {
      const res = await api().post('/api/auth/register/verify-otp').send({
        name: 'Hacker',
        email: `hacker${uniq}@example.com`,
        phone: `7${String(uniq).slice(-9)}`,
        password: 'secret123',
        otp: '123456',
        role: 'ADMIN'
      });
      // role is not accepted — either a validation error or the created user
      // must never be an admin.
      if (res.status === 201) {
        expect(res.body.data.user.role).toBe('TOURIST');
      } else {
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('login (same endpoint for tourist + admin)', () => {
    it('logs in a tourist and returns a TOURIST role', async () => {
      const data = await loginTourist();
      expect(data.user.role).toBe('TOURIST');
      expect(data.accessToken).toBeDefined();
    });

    it('logs in an admin through the SAME endpoint and returns ADMIN', async () => {
      const data = await loginAdmin();
      expect(data.user.role).toBe('ADMIN');
    });

    it('rejects bad credentials without revealing admin existence', async () => {
      const res = await api().post('/api/auth/login').send({
        email: 'admin@tourguard.ai',
        password: 'wrong-password'
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns the current user from /me', async () => {
      const t = await loginTourist();
      const res = await api().get('/api/auth/me').set(auth(t.accessToken));
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('arun@example.com');
    });

    it('rejects /me without a token', async () => {
      const res = await api().get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
