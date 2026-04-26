const router     = require('express').Router();
const requireAuth = require('../middleware/auth');

module.exports = function teamRoutes(db) {
  // GET /api/team — all users (simulate org members)
  router.get('/', requireAuth, (req, res) => {
    const members = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id != ?').all(req.user.id);
    res.json(members);
  });

  // POST /api/team/availability — check availability for a datetime window
  router.post('/availability', requireAuth, (req, res) => {
    const { datetime, duration, userIds } = req.body;
    if (!datetime || !duration || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'datetime, duration and userIds are required' });
    }

    const start = new Date(datetime);
    const end   = new Date(start.getTime() + duration * 60_000);

    const results = userIds.map(uid => {
      const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(uid);
      if (!user) return { userId: uid, status: 'unknown' };

      // Check for overlapping meetings
      const clash = db.prepare(`
        SELECT m.id, m.title FROM meetings m
        JOIN meeting_attendees ma ON ma.meeting_id = m.id
        WHERE ma.user_id = ?
          AND datetime(m.datetime) < datetime(?)
          AND datetime(m.datetime, '+' || m.duration || ' minutes') > datetime(?)
      `).get(uid, end.toISOString(), start.toISOString());

      return {
        userId: uid,
        name:   user.name,
        email:  user.email,
        status: clash ? 'in_meeting' : 'available',
        clash:  clash || null,
      };
    });

    res.json(results);
  });

  return router;
};
