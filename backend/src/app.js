const express = require('express');
const cors    = require('cors');

const authRoutes         = require('./routes/auth');
const meetingRoutes      = require('./routes/meetings');
const analysisRoutes     = require('./routes/analysis');
const agendaRoutes       = require('./routes/agenda');
const teamRoutes         = require('./routes/team');
const dashboardRoutes    = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');

function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth',          authRoutes(db));
  app.use('/api/meetings',      meetingRoutes(db));
  app.use('/api/analysis',      analysisRoutes(db));
  app.use('/api/meetings',      agendaRoutes(db));   // nested: /api/meetings/:id/agenda
  app.use('/api/team',          teamRoutes(db));
  app.use('/api/dashboard',     dashboardRoutes(db));
  app.use('/api/notifications', notificationRoutes(db));

  app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}

module.exports = { createApp };
