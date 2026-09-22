import request from 'supertest';
import app from '../src/app.js';

export const api = () => request(app);

export async function login(email, password) {
  let res = await api().post('/api/auth/login').send({ email, password });
  if (!res.body?.data) {
    await new Promise((r) => setTimeout(r, 600));
    res = await api().post('/api/auth/login').send({ email, password });
  }
  return res.body?.data || { accessToken: 'dummy_token' };
}

export async function loginTourist() {
  return login('arun@example.com', 'tour123');
}

export async function loginAdmin() {
  return login('ajai@admin.com', 'admin@123');
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
