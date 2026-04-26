const router     = require('express').Router();
const requireAuth = require('../middleware/auth');

module.exports = function dashboardRoutes(db) {
  // GET /api/dashboard — all stats in one request
  router.get('/', requireAuth, (req, res) => {
    const userId = req.user.id;
    const now    = new Date().toISOString();

    // Upcoming meetings count
    const { count: upcomingCount } = db.prepare(`
      SELECT COUNT(*) AS count FROM meetings
      WHERE owner_id = ? AND datetime > ?
    `).get(userId, now);

    // Total meeting hours (all time for this user)
    const { total: meetingMinutes } = db.prepare(`
      SELECT COALESCE(SUM(duration), 0) AS total FROM meetings WHERE owner_id = ?
    `).get(userId);

    // Room usage: booked meetings with a location / total meetings
    const { total: totalMeetings } = db.prepare('SELECT COUNT(*) AS total FROM meetings WHERE owner_id = ?').get(userId);
    const { booked }               = db.prepare("SELECT COUNT(*) AS booked FROM meetings WHERE owner_id = ? AND location IS NOT NULL AND location != ''").get(userId);
    const roomUsagePct             = totalMeetings > 0 ? Math.round((booked / totalMeetings) * 100) : 0;

    // Team members count (all users including self)
    const { count: teamCount } = db.prepare('SELECT COUNT(*) AS count FROM users').get();

    // Today's schedule
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todaysMeetings = db.prepare(`
      SELECT * FROM meetings
      WHERE owner_id = ?
        AND datetime >= ? AND datetime <= ?
      ORDER BY datetime ASC
    `).all(userId, todayStart.toISOString(), todayEnd.toISOString());

    // Recent activity (last 20)
    const recentActivity = db.prepare(`
      SELECT a.*, u.name AS user_name FROM activity a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
      LIMIT 20
    `).all(userId);

    res.json({
      upcomingMeetings: upcomingCount,
      meetingHours:     Math.round(meetingMinutes / 60 * 10) / 10,
      teamMembers:      teamCount,
      roomUsagePct,
      todaysSchedule:   todaysMeetings,
      recentActivity,
    });
  });

  return router;
};
