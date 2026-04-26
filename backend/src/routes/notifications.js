const router     = require('express').Router();
const requireAuth = require('../middleware/auth');

module.exports = function notificationRoutes(db) {
  // GET /api/notifications — unread notifications for current user
  router.get('/', requireAuth, (req, res) => {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ? AND read = 0
      ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(notifications);
  });

  // PATCH /api/notifications/:id/read
  router.patch('/:id/read', requireAuth, (req, res) => {
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(notif.id);
    res.json({ ...notif, read: true });
  });

  return router;
};
