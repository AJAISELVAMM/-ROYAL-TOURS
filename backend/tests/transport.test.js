import { api } from './helpers.js';

describe('Transport & fare', () => {
  it('returns transport routes with distance/duration/steps/fare', async () => {
    const res = await api().get('/api/transport/routes?from=Railway%20Station&to=Marudamalai&mode=auto');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.distanceKm).toBeGreaterThan(0);
    expect(d.durationMinutes).toBeGreaterThan(0);
    expect(d.steps.length).toBeGreaterThan(0);
    expect(d.fare.estimatedMin).toBeGreaterThan(0);
  });

  it('returns a fare estimate', async () => {
    const res = await api().get('/api/fare/estimate?from=Railway%20Station&to=Marudamalai&vehicleType=taxi');
    expect(res.status).toBe(200);
    expect(res.body.data.fare.currency).toBe('INR');
  });

  it('checks a quoted fare and returns a verdict', async () => {
    const res = await api().post('/api/fare/check').send({
      from: 'Railway Station',
      to: 'Marudamalai',
      vehicleType: 'auto',
      quotedFare: 500
    });
    expect(res.status).toBe(200);
    expect(['FAIR', 'SLIGHTLY_HIGH', 'POSSIBLE_OVERCHARGE']).toContain(res.body.data.verdict);
  });

  it('rejects a fare check with missing origin', async () => {
    const res = await api().post('/api/fare/check').send({ to: 'Marudamalai', quotedFare: 100 });
    expect(res.status).toBe(400);
  });
});
