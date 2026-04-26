const request = require('supertest');
const { setupTestApp, createUser, getToken, FUTURE } = require('./helpers');

let app, db, token, user, otherToken, otherUser;

beforeAll(async () => {
  ({ app, db } = setupTestApp());
  user       = createUser(db, { email: 'owner@test.com' });
  otherUser  = createUser(db, { email: 'other@test.com' });
  token      = await getToken(app, user.email, user.password);
  otherToken = await getToken(app, otherUser.email, otherUser.password);
});

const validMeeting = () => ({
  title: 'Design Review', goal: 'decision', duration: 60,
  datetime: FUTURE, attendeeIds: [],
});

describe('M1 — Create meeting with valid data', () => {
  it('returns 201 with meeting object', async () => {
    const res = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`).send(validMeeting());
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Design Review');
  });
});

describe('M2 — Create meeting missing title', () => {
  it('returns 400', async () => {
    const { title, ...body } = validMeeting();
    const res = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(400);
  });
});

describe('M3 — Create meeting with past datetime', () => {
  it('returns 400', async () => {
    const res = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
      .send({ ...validMeeting(), datetime: '2000-01-01T10:00:00Z' });
    expect(res.status).toBe(400);
  });
});

describe('M4 — Get all meetings for user', () => {
  it('only returns own meetings', async () => {
    // Create a meeting as otherUser
    await request(app).post('/api/meetings').set('Authorization', `Bearer ${otherToken}`).send(validMeeting());
    const res = await request(app).get('/api/meetings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach(m => expect(m.owner_id).toBe(user.id));
  });
});

describe('M5 — Get single meeting', () => {
  it('returns meeting object', async () => {
    const created = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`).send(validMeeting());
    const res = await request(app).get(`/api/meetings/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });
});

describe('M6 — Get other user meeting', () => {
  it('returns 403', async () => {
    const created = await request(app).post('/api/meetings').set('Authorization', `Bearer ${otherToken}`).send(validMeeting());
    const res = await request(app).get(`/api/meetings/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('M7 — Get non-existent meeting', () => {
  it('returns 404', async () => {
    const res = await request(app).get('/api/meetings/99999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('M8 — Update meeting duration', () => {
  it('returns updated object', async () => {
    const created = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`).send(validMeeting());
    const res = await request(app).patch(`/api/meetings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`).send({ duration: 30 });
    expect(res.status).toBe(200);
    expect(res.body.duration).toBe(30);
  });
});

describe('M9 — Update meeting with invalid attendee ID', () => {
  it('returns 400', async () => {
    const created = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`).send(validMeeting());
    const res = await request(app).patch(`/api/meetings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`).send({ attendeeIds: [99999] });
    expect(res.status).toBe(400);
  });
});

describe('M10 — Delete meeting', () => {
  it('returns 204', async () => {
    const created = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`).send(validMeeting());
    const res = await request(app).delete(`/api/meetings/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

describe('M11 — Delete other user meeting', () => {
  it('returns 403', async () => {
    const created = await request(app).post('/api/meetings').set('Authorization', `Bearer ${otherToken}`).send(validMeeting());
    const res = await request(app).delete(`/api/meetings/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
