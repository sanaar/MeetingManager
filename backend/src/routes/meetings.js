const router     = require('express').Router();
const requireAuth = require('../middleware/auth');

const VALID_GOALS = ['decision', 'problem', 'brainstorm', 'share', 'other'];

module.exports = function meetingRoutes(db) {
  // GET /api/meetings
  router.get('/', requireAuth, (req, res) => {
    const meetings = db.prepare(`
      SELECT m.*, GROUP_CONCAT(ma.user_id) AS attendee_ids
      FROM meetings m
      LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id
      WHERE m.owner_id = ?
      GROUP BY m.id
      ORDER BY m.datetime ASC
    `).all(req.user.id);

    res.json(meetings.map(m => ({
      ...m,
      attendeeIds: m.attendee_ids ? m.attendee_ids.split(',').map(Number) : [],
    })));
  });

  // GET /api/meetings/:id
  router.get('/:id', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const attendees = db.prepare(
      'SELECT u.id, u.name, u.email FROM users u JOIN meeting_attendees ma ON ma.user_id = u.id WHERE ma.meeting_id = ?'
    ).all(meeting.id);

    res.json({ ...meeting, attendees });
  });

  // POST /api/meetings
  router.post('/', requireAuth, (req, res) => {
    const { title, description, goal, duration, datetime, location, attendeeIds = [] } = req.body;

    if (!title)    return res.status(400).json({ error: 'title is required' });
    if (!goal)     return res.status(400).json({ error: 'goal is required' });
    if (!duration) return res.status(400).json({ error: 'duration is required' });
    if (!datetime) return res.status(400).json({ error: 'datetime is required' });
    if (!VALID_GOALS.includes(goal)) return res.status(400).json({ error: `goal must be one of: ${VALID_GOALS.join(', ')}` });
    if (new Date(datetime) <= new Date()) return res.status(400).json({ error: 'datetime must be in the future' });

    // Validate attendee IDs exist
    for (const uid of attendeeIds) {
      const u = db.prepare('SELECT id FROM users WHERE id = ?').get(uid);
      if (!u) return res.status(400).json({ error: `User ${uid} not found` });
    }

    const { lastInsertRowid: id } = db.prepare(
      'INSERT INTO meetings (owner_id, title, description, goal, duration, datetime, location) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, title, description || null, goal, duration, datetime, location || null);

    const insertAttendee = db.prepare('INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)');
    for (const uid of attendeeIds) insertAttendee.run(id, uid);

    // Log activity
    db.prepare('INSERT INTO activity (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'created_meeting', 'meeting', id);

    // Notify attendees
    const notifyStmt = db.prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)');
    for (const uid of attendeeIds) {
      if (uid !== req.user.id) {
        notifyStmt.run(uid, 'meeting_invite', `You've been invited to "${title}"`);
      }
    }

    res.status(201).json({ id, title, goal, duration, datetime, location, attendeeIds });
  });

  // PATCH /api/meetings/:id
  router.patch('/:id', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, goal, duration, datetime, location, attendeeIds } = req.body;

    if (goal && !VALID_GOALS.includes(goal)) return res.status(400).json({ error: `goal must be one of: ${VALID_GOALS.join(', ')}` });
    if (datetime && new Date(datetime) <= new Date()) return res.status(400).json({ error: 'datetime must be in the future' });

    if (attendeeIds) {
      for (const uid of attendeeIds) {
        const u = db.prepare('SELECT id FROM users WHERE id = ?').get(uid);
        if (!u) return res.status(400).json({ error: `User ${uid} not found` });
      }
    }

    db.prepare(`
      UPDATE meetings SET
        title       = COALESCE(?, title),
        description = COALESCE(?, description),
        goal        = COALESCE(?, goal),
        duration    = COALESCE(?, duration),
        datetime    = COALESCE(?, datetime),
        location    = COALESCE(?, location)
      WHERE id = ?
    `).run(title ?? null, description ?? null, goal ?? null, duration ?? null, datetime ?? null, location ?? null, meeting.id);

    if (attendeeIds) {
      db.prepare('DELETE FROM meeting_attendees WHERE meeting_id = ?').run(meeting.id);
      const insertAttendee = db.prepare('INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)');
      for (const uid of attendeeIds) insertAttendee.run(meeting.id, uid);
    }

    res.json(db.prepare('SELECT * FROM meetings WHERE id = ?').get(meeting.id));
  });

  // DELETE /api/meetings/:id
  router.delete('/:id', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    db.prepare('DELETE FROM meetings WHERE id = ?').run(meeting.id);
    res.status(204).send();
  });

  // POST /api/meetings/:id/attendees
  router.post('/:id/attendees', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { userId } = req.body;
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.prepare('INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)').run(meeting.id, userId);

    db.prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)')
      .run(userId, 'meeting_invite', `You've been invited to "${meeting.title}"`);

    res.json({ meetingId: meeting.id, user });
  });

  return router;
};
