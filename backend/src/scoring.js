const GOAL_FOCUS = { decision: 23, problem: 20, brainstorm: 17, share: 10, other: 13 };
const GOAL_BALANCE = { decision: 25, problem: 22, brainstorm: 19, share: 10, other: 14 };
const OPTIMAL_DURATION = { decision: 30, problem: 45, brainstorm: 60, share: 20, other: 30 };
const GOAL_TOPICS = {
  decision: ['Review options', 'Evaluate trade-offs', 'Make final decision', 'Assign ownership'],
  problem:  ['Define the problem', 'Explore solutions', 'Agree on approach', 'Next steps'],
  brainstorm: ['Share ideas', 'Build on ideas', 'Prioritise', 'Capture actions'],
  share:    ['Present update', 'Q&A', 'Align on next steps'],
  other:    ['Open discussion', 'Align on goals', 'Next steps'],
};

function scoreFocus(goal) {
  return GOAL_FOCUS[goal] ?? 10;
}

function scoreCollaboration(attendeeCount) {
  if (attendeeCount <= 0) return 0;
  if (attendeeCount === 1) return 8;
  if (attendeeCount === 2) return 16;
  if (attendeeCount >= 3 && attendeeCount <= 5) return 25;
  if (attendeeCount === 6) return 20;
  if (attendeeCount <= 9) return 14;
  if (attendeeCount <= 14) return 8;
  return 4;
}

function scoreTime(duration, goal) {
  const optimal = OPTIMAL_DURATION[goal] ?? 30;
  const ratio = duration / optimal;
  if (ratio <= 1)   return 25;
  if (ratio <= 1.5) return 18;
  if (ratio <= 2)   return 12;
  if (ratio <= 3)   return 6;
  return 2;
}

function scoreBalance(goal) {
  return GOAL_BALANCE[goal] ?? 12;
}

function analyzeAndScore({ topic, goal, duration, attendeeCount }) {
  const focusScore         = scoreFocus(goal);
  const collaborationScore = scoreCollaboration(attendeeCount);
  const timeScore          = scoreTime(duration, goal);
  const balanceScore       = scoreBalance(goal);
  const score              = focusScore + collaborationScore + timeScore + balanceScore;
  const keyTopics          = extractKeyTopics(goal);
  const factors            = deriveFactors({ attendeeCount, goal, duration });

  return { score, focusScore, collaborationScore, timeScore, balanceScore, keyTopics, factors };
}

function extractKeyTopics(goal) {
  return GOAL_TOPICS[goal] ?? GOAL_TOPICS.other;
}

function deriveFactors({ attendeeCount, goal, duration }) {
  const factors = [];
  if (attendeeCount >= 3 && attendeeCount <= 6) {
    factors.push({ impact: 'positive', title: 'Good attendee fit', description: "You've invited the right number of people for this goal." });
  } else if (attendeeCount === 1 || attendeeCount === 2) {
    factors.push({ impact: 'info', title: 'Small group', description: 'Consider whether a quick message would work instead.' });
  } else if (attendeeCount > 10) {
    factors.push({ impact: 'negative', title: 'Too many attendees', description: 'Large groups make it hard to reach decisions efficiently.' });
  } else {
    factors.push({ impact: 'positive', title: 'Reasonable group size', description: 'Group size is manageable for this type of meeting.' });
  }
  if (goal === 'share') {
    factors.push({ impact: 'info', title: 'Information sharing', description: 'This could be done async — consider a recorded update or doc.' });
  } else if (goal === 'decision') {
    factors.push({ impact: 'positive', title: 'Clear decision goal', description: 'Decision meetings benefit most from structure and prep.' });
  } else if (goal === 'brainstorm') {
    factors.push({ impact: 'positive', title: 'Creative goal', description: 'Brainstorms work well in person with the right structure.' });
  } else if (goal === 'problem') {
    factors.push({ impact: 'positive', title: 'Problem-solving focus', description: 'Well-suited for a meeting if the problem is well-defined.' });
  }
  const optimal = OPTIMAL_DURATION[goal] ?? 30;
  if (duration > optimal * 2) {
    factors.push({ impact: 'negative', title: 'Meeting is too long', description: `Optimal for this goal is ~${optimal} min. Consider cutting it down.` });
  } else if (duration > optimal * 1.5) {
    factors.push({ impact: 'negative', title: 'Meeting may be too long', description: 'Consider shortening to maintain focus throughout.' });
  } else if (duration <= optimal) {
    factors.push({ impact: 'positive', title: 'Well-timed meeting', description: 'Duration is a good fit for the complexity of the goal.' });
  } else {
    factors.push({ impact: 'info', title: 'Slightly over optimal', description: `Ideal duration for this goal is ~${optimal} min.` });
  }
  return factors;
}

function getRecommendations(scores, { duration, goal }) {
  const { score } = scores;
  const recs = [];
  if (score >= 80) {
    recs.push({ type: 'run_as_planned', isPrimary: true,  proposedDuration: duration, reasoning: 'This meeting is well structured and worth running.' });
    recs.push({ type: 'email',          isPrimary: false, proposedDuration: null,     reasoning: 'Could an email cover this instead?' });
  } else if (score >= 60) {
    const shortened = Math.max(15, Math.round(duration * 0.5));
    recs.push({ type: 'shorten', isPrimary: true,  proposedDuration: shortened, reasoning: 'This meeting has value but can be shorter and more focused.' });
    recs.push({ type: 'email',   isPrimary: false, proposedDuration: null,      reasoning: 'A well-crafted email could replace this entirely.' });
    recs.push({ type: 'async',   isPrimary: false, proposedDuration: null,      reasoning: 'An async doc or Loom video could work here.' });
  } else if (score >= 40) {
    const shortened = Math.max(15, Math.round(duration * 0.5));
    recs.push({ type: 'async',   isPrimary: true,  proposedDuration: null,      reasoning: 'This would work better as an async update.' });
    recs.push({ type: 'email',   isPrimary: false, proposedDuration: null,      reasoning: 'A well-crafted email could replace this entirely.' });
    recs.push({ type: 'shorten', isPrimary: false, proposedDuration: shortened, reasoning: 'If you must meet, shorten significantly.' });
  } else {
    recs.push({ type: 'cancel', isPrimary: true,  proposedDuration: null, reasoning: 'This meeting may not be necessary at all.' });
    recs.push({ type: 'email',  isPrimary: false, proposedDuration: null, reasoning: 'An email would be far more efficient.' });
  }
  return recs;
}

function generateProposedAgenda(keyTopics, proposedDuration) {
  const intro   = 5;
  const closing = 5;
  const main    = Math.max(0, proposedDuration - intro - closing);
  const topics  = keyTopics.slice(0, 3);
  const perTopic = topics.length > 0 ? Math.floor(main / topics.length) : 0;

  return [
    { title: 'Welcome & goals', description: 'Align on the objective', duration: intro,   orderIndex: 0 },
    ...topics.map((t, i) => ({ title: t, description: '', duration: perTopic, orderIndex: i + 1 })),
    { title: 'Next steps', description: 'Action items & owners',        duration: closing, orderIndex: topics.length + 1 },
  ];
}

module.exports = { analyzeAndScore, getRecommendations, generateProposedAgenda, scoreCollaboration, scoreTime };
