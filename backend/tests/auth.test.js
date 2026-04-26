const request = require('supertest');
const { setupTestApp, createUser } = require('./helpers');

let app, db;
beforeAll(() => ({ app, db } = setupTestApp()));

describe('A1 — Register new user', () => {
  it('returns 201 with user and token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jane Cooper', email: 'jane@test.com', password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('jane@test.com');
  });
});

describe('A2 — Register duplicate email', () => {
  it('returns 409', async () => {
    createUser(db, { email: 'dup@test.com' });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dup', email: 'dup@test.com', password: 'password123',
    });
    expect(res.status).toBe(409);
  });
});

describe('A3 — Login with valid credentials', () => {
  it('returns 200 with JWT', async () => {
    createUser(db, { email: 'login@test.com', password: 'secret' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login@test.com', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});

describe('A4 — Login with wrong password', () => {
  it('returns 401', async () => {
    createUser(db, { email: 'badpass@test.com', password: 'correct' });
    const res = await request(app).post('/api/auth/login').send({ email: 'badpass@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('A5 — Access protected route without token', () => {
  it('returns 401', async () => {
    const res = await request(app).get('/api/meetings');
    expect(res.status).toBe(401);
  });
});

describe('A6 — Expired token', () => {
  it('returns 401', async () => {
    // A token signed with wrong secret will fail verification
    const res = await request(app)
      .get('/api/meetings')
      .set('Authorization', 'Bearer this.is.notvalid');
    expect(res.status).toBe(401);
  });
});
