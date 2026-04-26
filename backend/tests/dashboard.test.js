const request = require('supertest');
const { setupTestApp, createUser, getToken, FUTURE } = require('./helpers');

let app, db, token, user;

beforeAll(async () => {
  ({ app, db } = setupTestApp());
  user  = createUser(db, { email: 'dash@test.com' });
  token = await getToken(app, user.email, user.password);

  // Seed two upcoming meetings
  await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
    .send({ title: 'Meeting A', goal: 'decision', duration: 60, datetime: FUTURE, location: 'Room A' });
  await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
    .send({ title: 'Meeting B', goal: 'share',    duration: 30, datetime: FUTURE });
});

describe('D1 — Upcoming meetings count', () => {
  it('matches the number of future meetings', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.upcomingMeetings).toBe(2);
  });
});

describe('D2 — Meeting hours', () => {
  it('is the sum of all meeting durations in hours', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    // 60 + 30 = 90 min = 1.5 hours
    expect(res.body.meetingHours).toBe(1.5);
  });
});

describe('D3 — Room usage percentage', () => {
  it('is 0–100 and reflects booked rooms', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    // 1 out of 2 meetings has a location → 50%
    expect(res.body.roomUsagePct).toBe(50);
  });
});

describe('D4 — Recent activity feed', () => {
  it('is ordered newest first', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    const activity = res.body.recentActivity;
    expect(Array.isArray(activity)).toBe(true);
    for (let i = 1; i < activity.length; i++) {
      expect(new Date(activity[i - 1].created_at) >= new Date(activity[i].created_at)).toBe(true);
    }
  });
});

describe('D5 — Today\'s schedule only contains today\'s meetings', () => {
  it('returns meetings within today', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    const today = new Date();
    res.body.todaysSchedule.forEach(m => {
      const d = new Date(m.datetime);
      expect(d.toDateString()).toBe(today.toDateString());
    });
  });
});
