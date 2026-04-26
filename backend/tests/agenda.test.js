const request = require('supertest');
const { setupTestApp, createUser, getToken, FUTURE } = require('./helpers');

let app, db, token, user, meetingId;

beforeAll(async () => {
  ({ app, db } = setupTestApp());
  user  = createUser(db, { email: 'agenda@test.com' });
  token = await getToken(app, user.email, user.password);

  const m = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
    .send({ title: 'Planning', goal: 'decision', duration: 60, datetime: FUTURE });
  meetingId = m.body.id;
});

const items = () => [
  { title: 'Welcome', description: 'Intro', duration: 5 },
  { title: 'Main topic', description: 'Core discussion', duration: 40 },
  { title: 'Next steps', description: 'Actions', duration: 15 },
];

describe('AG1 — Create agenda for a meeting', () => {
  it('returns 201 and stored items', async () => {
    const res = await request(app).post(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`).send({ items: items() });
    expect(res.status).toBe(201);
    expect(res.body.length).toBe(3);
  });
});

describe('AG2 — Agenda items exceed meeting duration', () => {
  it('returns 400', async () => {
    const overItems = [
      { title: 'Too long', duration: 45 },
      { title: 'Also long', duration: 45 },
    ];
    const res = await request(app).post(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`).send({ items: overItems });
    expect(res.status).toBe(400);
  });
});

describe('AG3 — Update an agenda item', () => {
  it('returns updated item', async () => {
    await request(app).post(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`).send({ items: items() });
    const agendaRes = await request(app).get(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`);
    const itemId = agendaRes.body[0].id;

    const res = await request(app).patch(`/api/meetings/${meetingId}/agenda/${itemId}`)
      .set('Authorization', `Bearer ${token}`).send({ title: 'Updated title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
  });
});

describe('AG4 — Delete an agenda item', () => {
  it('returns 204', async () => {
    await request(app).post(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`).send({ items: items() });
    const agendaRes = await request(app).get(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`);
    const itemId = agendaRes.body[0].id;

    const res = await request(app).delete(`/api/meetings/${meetingId}/agenda/${itemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

describe('AG5 — Agenda items sum equals meeting duration', () => {
  it('items total <= meeting duration', async () => {
    const res = await request(app).post(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`).send({ items: items() });
    const total = res.body.reduce((sum, i) => sum + i.duration, 0);
    expect(total).toBeLessThanOrEqual(60);
  });
});

describe('AG6 — Reorder agenda items', () => {
  it('persists new order', async () => {
    await request(app).post(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`).send({ items: items() });
    const agendaRes = await request(app).get(`/api/meetings/${meetingId}/agenda`)
      .set('Authorization', `Bearer ${token}`);
    const ids = agendaRes.body.map(i => i.id);
    const reversed = [...ids].reverse();

    const res = await request(app).put(`/api/meetings/${meetingId}/agenda/reorder`)
      .set('Authorization', `Bearer ${token}`).send({ order: reversed });
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(reversed[0]);
  });
});
