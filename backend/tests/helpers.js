const request = require('supertest');
const bcrypt  = require('bcryptjs');
const { createDb }  = require('../src/db');
const { createApp } = require('../src/app');

function setupTestApp() {
  const db  = createDb();          // fresh in-memory DB per test file
  const app = createApp(db);
  return { db, app };
}

function createUser(db, overrides = {}) {
  const name  = overrides.name  || 'Test User';
  const email = overrides.email || `user_${Date.now()}@test.com`;
  const pass  = overrides.password || 'password123';
  const hash  = bcrypt.hashSync(pass, 10);
  const { lastInsertRowid: id } = db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  ).run(name, email, hash);
  return { id, name, email, password: pass };
}

async function getToken(app, email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

const FUTURE = '2099-06-01T10:00:00.000Z';

module.exports = { setupTestApp, createUser, getToken, FUTURE };
