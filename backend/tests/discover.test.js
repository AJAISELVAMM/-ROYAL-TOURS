import { api } from './helpers.js';

describe('Discover', () => {
  it('lists places with pagination', async () => {
    const res = await api().get('/api/discover/places?limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it('filters places by search', async () => {
    const res = await api().get('/api/discover/places?search=Temple');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('returns a single place detail', async () => {
    const list = await api().get('/api/discover/places?limit=1');
    const id = list.body.data.items[0].id;
    const res = await api().get(`/api/discover/places/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('lists hotels, restaurants, theatres and shopping', async () => {
    for (const type of ['hotels', 'restaurants', 'theatres', 'shopping']) {
      const res = await api().get(`/api/discover/${type}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    }
  });

  it('returns theatre shows', async () => {
    const theatres = await api().get('/api/discover/theatres');
    const theatre = theatres.body.data.items.find((t) => t.shows);
    const id = theatre ? theatre.id : theatres.body.data.items[0].id;
    const res = await api().get(`/api/discover/theatres/${id}/shows`);
    expect(res.status).toBe(200);
    expect(res.body.data.theatre).toBeDefined();
  });

  it('returns 404 for an unknown type', async () => {
    const res = await api().get('/api/discover/unknown');
    expect(res.status).toBe(404);
  });
});
