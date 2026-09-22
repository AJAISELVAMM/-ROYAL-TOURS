import { api, login, loginTourist, auth } from './helpers.js';

describe('Travel groups', () => {
  let owner;
  let other;

  beforeAll(async () => {
    owner = await loginTourist(); // arun — owns the seeded trip
    other = await login('priya@example.com', 'tour123'); // different tourist
  });

  it('lists groups/members for the owner', async () => {
    const trips = await api().get('/api/trips').set(auth(owner.accessToken));
    const tripId = trips.body.data[0].id;

    const res = await api().get(`/api/groups/${tripId}`).set(auth(owner.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.members.length).toBeGreaterThan(0);
  });

  it('blocks a non-member tourist from accessing the group', async () => {
    const trips = await api().get('/api/trips').set(auth(owner.accessToken));
    const tripId = trips.body.data[0].id;

    const res = await api().get(`/api/groups/${tripId}`).set(auth(other.accessToken));
    expect(res.status).toBe(403);
  });

  it('starts location sharing (explicit consent) for a member', async () => {
    const trips = await api().get('/api/trips').set(auth(owner.accessToken));
    const tripId = trips.body.data[0].id;

    const res = await api()
      .post(`/api/location/${tripId}/start`)
      .set(auth(owner.accessToken))
      .send({ latitude: 11.0, longitude: 76.96, accuracy: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.sharing).toBe(true);
  });

  it('blocks location sharing for a non-member', async () => {
    const trips = await api().get('/api/trips').set(auth(owner.accessToken));
    const tripId = trips.body.data[0].id;

    const res = await api()
      .post(`/api/location/${tripId}/start`)
      .set(auth(other.accessToken))
      .send({ latitude: 11.0, longitude: 76.96 });
    expect(res.status).toBe(403);
  });

  it('stops location sharing', async () => {
    const trips = await api().get('/api/trips').set(auth(owner.accessToken));
    const tripId = trips.body.data[0].id;

    const res = await api().post(`/api/location/${tripId}/stop`).set(auth(owner.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.sharing).toBe(false);
  });

  it('initiates a group call to a member', async () => {
    const trips = await api().get('/api/trips').set(auth(owner.accessToken));
    const targetTrip = trips.body.data.find((t) => (t.members || []).some((m) => m.userId !== owner.user.id && m.phone !== owner.user.phone && m.phone !== '9876543210')) || trips.body.data[0];
    const trip = await api().get(`/api/trips/${targetTrip.id}`).set(auth(owner.accessToken));
    const member = trip.body.data.members.find((m) => m.userId !== owner.user.id && m.phone !== owner.user.phone && m.phone !== '9876543210');

    const res = await api()
      .post(`/api/groups/${targetTrip.id}/call`)
      .set(auth(owner.accessToken))
      .send({ memberId: member.id });
    expect(res.status).toBe(200);
    expect(res.body.data.call.receiver.name).toBe(member.name);
  });

  it('removes a leaving member so remaining members and backend queries no longer return them', async () => {
    const trips = await api().get('/api/trips').set(auth(owner.accessToken));
    const trip = trips.body.data[0];
    const groupCode = trip.groupCode || `TG-${trip.id.slice(-6).toUpperCase()}`;

    // Other tourist (Priya) joins the group by code
    const joinRes = await api().post('/api/groups/join').set(auth(other.accessToken)).send({ code: groupCode });
    expect(joinRes.status).toBe(200);

    // Verify Priya is in active members
    const membersBefore = await api().get(`/api/groups/${trip.id}/members`).set(auth(owner.accessToken));
    expect(membersBefore.status).toBe(200);
    const hasOtherBefore = membersBefore.body.data.some((m) => m.userId === other.user.id);
    expect(hasOtherBefore).toBe(true);

    // Priya leaves the group
    const leaveRes = await api().post(`/api/groups/${trip.id}/leave`).set(auth(other.accessToken));
    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.data.success).toBe(true);

    // Verify backend active member query NO LONGER returns Priya for owner
    const membersAfter = await api().get(`/api/groups/${trip.id}/members`).set(auth(owner.accessToken));
    expect(membersAfter.status).toBe(200);
    const hasOtherAfter = membersAfter.body.data.some((m) => m.userId === other.user.id);
    expect(hasOtherAfter).toBe(false);

    // Verify Priya cannot access group anymore
    const priyaAccess = await api().get(`/api/groups/${trip.id}`).set(auth(other.accessToken));
    expect(priyaAccess.status).toBe(403);
  });
});
