const router     = require('express').Router();
const requireAuth = require('../middleware/auth');

module.exports = function agendaRoutes(db) {
  // GET /api/meetings/:meetingId/agenda
  router.get('/:meetingId/agenda', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const items = db.prepare('SELECT * FROM agenda_items WHERE meeting_id = ? ORDER BY order_index ASC').all(meeting.id);
    res.json(items);
  });

  // POST /api/meetings/:meetingId/agenda — replace full agenda
  router.post('/:meetingId/agenda', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    const totalDuration = items.reduce((sum, i) => sum + (i.duration || 0), 0);
    if (totalDuration > meeting.duration) {
      return res.status(400).json({ error: `Agenda total (${totalDuration} min) exceeds meeting duration (${meeting.duration} min)` });
    }

    db.prepare('DELETE FROM agenda_items WHERE meeting_id = ?').run(meeting.id);

    const insert = db.prepare(
      'INSERT INTO agenda_items (meeting_id, title, description, duration, order_index) VALUES (?, ?, ?, ?, ?)'
    );
    const saved = items.map((item, idx) => {
      const { lastInsertRowid: id } = insert.run(
        meeting.id, item.title, item.description || null, item.duration || 0, idx
      );
      return { id, meetingId: meeting.id, title: item.title, description: item.description || null, duration: item.duration || 0, orderIndex: idx };
    });

    res.status(201).json(saved);
  });

  // PATCH /api/meetings/:meetingId/agenda/:itemId
  router.patch('/:meetingId/agenda/:itemId', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const item = db.prepare('SELECT * FROM agenda_items WHERE id = ? AND meeting_id = ?').get(req.params.itemId, meeting.id);
    if (!item) return res.status(404).json({ error: 'Agenda item not found' });

    const { title, description, duration } = req.body;

    if (duration !== undefined) {
      const otherTotal = db.prepare(
        'SELECT COALESCE(SUM(duration), 0) AS total FROM agenda_items WHERE meeting_id = ? AND id != ?'
      ).get(meeting.id, item.id).total;
      if (otherTotal + duration > meeting.duration) {
        return res.status(400).json({ error: `Updated total would exceed meeting duration (${meeting.duration} min)` });
      }
    }

    db.prepare(`
      UPDATE agenda_items SET
        title       = COALESCE(?, title),
        description = COALESCE(?, description),
        duration    = COALESCE(?, duration)
      WHERE id = ?
    `).run(title ?? null, description ?? null, duration ?? null, item.id);

    res.json(db.prepare('SELECT * FROM agenda_items WHERE id = ?').get(item.id));
  });

  // DELETE /api/meetings/:meetingId/agenda/:itemId
  router.delete('/:meetingId/agenda/:itemId', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const item = db.prepare('SELECT * FROM agenda_items WHERE id = ? AND meeting_id = ?').get(req.params.itemId, meeting.id);
    if (!item) return res.status(404).json({ error: 'Agenda item not found' });

    db.prepare('DELETE FROM agenda_items WHERE id = ?').run(item.id);
    res.status(204).send();
  });

  // PUT /api/meetings/:meetingId/agenda/reorder
  router.put('/:meetingId/agenda/reorder', requireAuth, (req, res) => {
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { order } = req.body; // array of item IDs in new order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of item IDs' });

    const updateOrder = db.prepare('UPDATE agenda_items SET order_index = ? WHERE id = ? AND meeting_id = ?');
    for (let i = 0; i < order.length; i++) updateOrder.run(i, order[i], meeting.id);

    const items = db.prepare('SELECT * FROM agenda_items WHERE meeting_id = ? ORDER BY order_index ASC').all(meeting.id);
    res.json(items);
  });

  return router;
};
