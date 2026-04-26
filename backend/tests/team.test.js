const request = require('supertest');
const { setupTestApp, createUser, getToken, FUTURE } = require('./helpers');

let app, db, token, user, memberA, memberB;

beforeAll(async () => {
  ({ app, db } = setupTestApp());
  user    = createUser(db, { email: 'teamowner@test.com' });
  memberA = createUser(db, { email: 'memberA@test.com' });
  memberB = createUser(db, { email: 'memberB@test.com' });
  token   = await getToken(app, user.email, user.password);
});

describe('T1 — Get team members', () => {
  it('returns all users', async () => {
    const res = await request(app).get('/api/team').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });
});

describe('T2 — Check availability when all free', () => {
  it('all members return available', async () => {
    const res = await request(app).post('/api/team/availability').set('Authorization', `Bearer ${token}`)
      .send({ datetime: FUTURE, duration: 60, userIds: [memberA.id, memberB.id] });
    expect(res.status).toBe(200);
    res.body.forEach(r => expect(r.status).toBe('available'));
  });
});

describe('T3 — Check availability when member has a clash', () => {
  it('returns "in_meeting" for clashing member', async () => {
    // memberA has a meeting at FUTURE
    await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Clash', goal: 'decision', duration: 60, datetime: FUTURE, attendeeIds: [memberA.id] });

    const res = await request(app).post('/api/team/availability').set('Authorization', `Bearer ${token}`)
      .send({ datetime: FUTURE, duration: 30, userIds: [memberA.id, memberB.id] });

    const memberAResult = res.body.find(r => r.userId === memberA.id);
    expect(memberAResult.status).toBe('in_meeting');
    const memberBResult = res.body.find(r => r.userId === memberB.id);
    expect(memberBResult.status).toBe('available');
  });
});

describe('T4 — Add a member to a meeting', () => {
  it('returns 200 and attendee', async () => {
    const m = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Add test', goal: 'decision', duration: 30, datetime: FUTURE });
    const res = await request(app).post(`/api/meetings/${m.body.id}/attendees`)
      .set('Authorization', `Bearer ${token}`).send({ userId: memberA.id });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(memberA.id);
  });
});

describe('T5 — Add non-existent user to meeting', () => {
  it('returns 404', async () => {
    const m = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
      .send({ title: 'No user', goal: 'decision', duration: 30, datetime: FUTURE });
    const res = await request(app).post(`/api/meetings/${m.body.id}/attendees`)
      .set('Authorization', `Bearer ${token}`).send({ userId: 99999 });
    expect(res.status).toBe(404);
  });
});

describe('T6 — Add duplicate attendee is idempotent', () => {
  it('returns 200 on second add', async () => {
    const m = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dup test', goal: 'decision', duration: 30, datetime: FUTURE });
    await request(app).post(`/api/meetings/${m.body.id}/attendees`)
      .set('Authorization', `Bearer ${token}`).send({ userId: memberB.id });
    const res = await request(app).post(`/api/meetings/${m.body.id}/attendees`)
      .set('Authorization', `Bearer ${token}`).send({ userId: memberB.id });
    expect(res.status).toBe(200);
  });
});
