const request = require('supertest');
const { setupTestApp, createUser, getToken, FUTURE } = require('./helpers');

let app, db, token, user, otherUser, otherToken;

beforeAll(async () => {
  ({ app, db } = setupTestApp());
  user       = createUser(db, { email: 'notif_owner@test.com' });
  otherUser  = createUser(db, { email: 'notif_member@test.com' });
  token      = await getToken(app, user.email, user.password);
  otherToken = await getToken(app, otherUser.email, otherUser.password);
});

describe('N1 — Notification created when user is invited to meeting', () => {
  it('otherUser has an unread notification', async () => {
    await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Invite test', goal: 'decision', duration: 30, datetime: FUTURE, attendeeIds: [otherUser.id] });

    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].message).toContain('Invite test');
  });
});

describe('N2 — Get unread notifications', () => {
  it('returns only unread notifications', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${otherToken}`);
    res.body.forEach(n => expect(n.read).toBeFalsy());
  });
});

describe('N3 — Mark notification as read', () => {
  it('returns read: true', async () => {
    const notifs = await request(app).get('/api/notifications').set('Authorization', `Bearer ${otherToken}`);
    const notifId = notifs.body[0].id;

    const res = await request(app).patch(`/api/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);

    // Should no longer appear in unread list
    const after = await request(app).get('/api/notifications').set('Authorization', `Bearer ${otherToken}`);
    expect(after.body.find(n => n.id === notifId)).toBeUndefined();
  });
});

describe('N4 — No notifications for other users\' meetings', () => {
  it('user has no notifications from meetings they were not invited to', async () => {
    // Create a meeting as otherUser without inviting user
    await request(app).post('/api/meetings').set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Private meeting', goal: 'share', duration: 30, datetime: FUTURE });

    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    const privateNotif = res.body.find(n => n.message?.includes('Private meeting'));
    expect(privateNotif).toBeUndefined();
  });
});
