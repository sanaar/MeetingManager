const request = require('supertest');
const { setupTestApp, createUser, getToken } = require('./helpers');

let app, db, token, user;

beforeAll(async () => {
  ({ app, db } = setupTestApp());
  user  = createUser(db, { email: 'analyst@test.com' });
  token = await getToken(app, user.email, user.password);
});

const validPayload = () => ({
  topic: 'Review the new product design mockups and gather feedback from the team',
  goal: 'decision', duration: 60, attendeeIds: [user.id],
});

describe('AN1 — Submit analysis with all fields', () => {
  it('returns score, keyTopics, factors, recommendations', async () => {
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`).send(validPayload());
    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.keyTopics).toBeDefined();
    expect(res.body.factors).toBeDefined();
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });
});

describe('AN2 — Submit analysis with no attendees', () => {
  it('returns 400', async () => {
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), attendeeIds: [] });
    expect(res.status).toBe(400);
  });
});

describe('AN3 — Submit analysis with no goal', () => {
  it('returns 400', async () => {
    const { goal, ...body } = validPayload();
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(400);
  });
});

describe('AN4 — Score components sum to total', () => {
  it('focus + collaboration + time + balance === score', async () => {
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`).send(validPayload());
    const { score, focusScore, collaborationScore, timeScore, balanceScore } = res.body;
    expect(score).toBe(focusScore + collaborationScore + timeScore + balanceScore);
  });
});

describe('AN5 — Score within valid range', () => {
  it('0 <= score <= 100', async () => {
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`).send(validPayload());
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
  });
});

describe('AN6 — Decision goal with 30-min duration scores well on focus', () => {
  it('focusScore >= 15', async () => {
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), goal: 'decision', duration: 30 });
    expect(res.body.focusScore).toBeGreaterThanOrEqual(15);
  });
});

describe('AN7 — Large attendee list penalises collaboration', () => {
  it('collaborationScore < 8 for 15+ attendees', async () => {
    const attendeeIds = Array.from({ length: 16 }, (_, i) => i + 1);
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), attendeeIds });
    expect(res.body.collaborationScore).toBeLessThan(8);
  });
});

describe('AN8 — "share" goal scores lower on balance', () => {
  it('balanceScore < 15 for information sharing', async () => {
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), goal: 'share' });
    expect(res.body.balanceScore).toBeLessThan(15);
  });
});

describe('AN9 — Analysis returns at least one recommendation', () => {
  it('recommendations array is non-empty', async () => {
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`).send(validPayload());
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });
});

describe('AN10 — Re-analyse after shortening raises score', () => {
  it('score with 30 min >= score with 120 min (for decision goal)', async () => {
    const long  = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), duration: 120 });
    const short = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), duration: 30 });
    expect(short.body.score).toBeGreaterThanOrEqual(long.body.score);
  });
});
