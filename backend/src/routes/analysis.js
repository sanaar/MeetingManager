const router     = require('express').Router();
const requireAuth = require('../middleware/auth');
const { analyzeAndScore, getRecommendations, generateProposedAgenda } = require('../scoring');

const VALID_GOALS = ['decision', 'problem', 'brainstorm', 'share', 'other'];

module.exports = function analysisRoutes(db) {
  // POST /api/analysis
  router.post('/', requireAuth, (req, res) => {
    const { topic, goal, duration, attendeeIds = [], meetingId } = req.body;

    if (!topic)              return res.status(400).json({ error: 'topic is required' });
    if (!goal)               return res.status(400).json({ error: 'goal is required' });
    if (!duration)           return res.status(400).json({ error: 'duration is required' });
    if (!VALID_GOALS.includes(goal)) return res.status(400).json({ error: `goal must be one of: ${VALID_GOALS.join(', ')}` });
    if (!attendeeIds.length) return res.status(400).json({ error: 'at least one attendee is required' });

    const attendeeCount = attendeeIds.length;
    const scores = analyzeAndScore({ topic, goal, duration, attendeeCount });
    const recommendations = getRecommendations(scores, { duration, goal });

    // Persist analysis
    const { lastInsertRowid: analysisId } = db.prepare(`
      INSERT INTO analyses
        (meeting_id, topic, goal, duration, attendee_count, score, focus_score, collaboration_score, time_score, balance_score, key_topics, factors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meetingId || null, topic, goal, duration, attendeeCount,
      scores.score, scores.focusScore, scores.collaborationScore, scores.timeScore, scores.balanceScore,
      JSON.stringify(scores.keyTopics),
      JSON.stringify(scores.factors),
    );

    // Persist recommendations
    const insertRec = db.prepare(
      'INSERT INTO recommendations (analysis_id, type, is_primary, proposed_duration, reasoning) VALUES (?, ?, ?, ?, ?)'
    );
    for (const r of recommendations) {
      insertRec.run(analysisId, r.type, r.isPrimary ? 1 : 0, r.proposedDuration ?? null, r.reasoning);
    }

    // Generate proposed agenda for the primary recommendation
    const primary = recommendations.find(r => r.isPrimary);
    const proposedAgenda = primary?.proposedDuration
      ? generateProposedAgenda(scores.keyTopics, primary.proposedDuration)
      : [];

    res.json({
      analysisId,
      score:               scores.score,
      focusScore:          scores.focusScore,
      collaborationScore:  scores.collaborationScore,
      timeScore:           scores.timeScore,
      balanceScore:        scores.balanceScore,
      keyTopics:           scores.keyTopics,
      factors:             scores.factors,
      recommendations,
      proposedAgenda,
    });
  });

  // GET /api/analysis/:id
  router.get('/:id', requireAuth, (req, res) => {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const recs = db.prepare('SELECT * FROM recommendations WHERE analysis_id = ?').all(analysis.id);
    res.json({
      ...analysis,
      keyTopics:       JSON.parse(analysis.key_topics || '[]'),
      factors:         JSON.parse(analysis.factors    || '[]'),
      recommendations: recs.map(r => ({ ...r, isPrimary: !!r.is_primary })),
    });
  });

  return router;
};
