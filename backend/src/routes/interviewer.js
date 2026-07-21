import { Router } from 'express';
import PanelAssignment from '../models/PanelAssignment.js';
import PanelScore from '../models/PanelScore.js';
import Application from '../models/Application.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  LEVELS, roundsForGrade, resolveCompetencies, recommendation,
} from '../utils/helpers.js';

const router = Router();
router.use(requireAuth, requireRole('interviewer'));

// An interviewer can hold more than one round on the same candidate.
async function myAssignments(req, applicationId) {
  return PanelAssignment.find({
    application_id: applicationId,
    interviewer_user_id: req.user._id,
  }).sort('round');
}

/* Rounds run in order: round N stays locked until rounds 1..N-1 are scored.
   Returns the round this interviewer may score now, plus why they can't if they
   can't. `mine` is their assignments, `scored` the rounds already submitted. */
function openRoundFor(mine, scoredRounds, requested) {
  const pending = mine.filter((a) => !scoredRounds.has(a.round));
  const target = requested
    ? mine.find((a) => a.round === Number(requested))
    : pending[0] || mine[0];
  if (!target) return { round: null, error: 'You are not on this candidate\'s panel' };

  const blocking = [];
  for (let n = 1; n < target.round; n++) if (!scoredRounds.has(n)) blocking.push(n);
  if (blocking.length) {
    return {
      round: null,
      assignment: target,
      error: `Round ${target.round} opens once round${blocking.length > 1 ? 's' : ''} ${blocking.join(', ')} ${blocking.length > 1 ? 'have' : 'has'} been scored.`,
    };
  }
  return { round: target.round, assignment: target, error: null };
}

// GET /api/interviewer/assignments — ONLY this interviewer's queue
router.get('/assignments', async (req, res) => {
  const assignments = await PanelAssignment.find({ interviewer_user_id: req.user._id })
    .sort('-assigned_at')
    .populate('application_id');
  // Which rounds are already in the bag, per application — needed to tell the
  // interviewer whether their round is open yet or still waiting on an earlier one.
  const live = assignments.filter((a) => a.application_id);
  const scores = await PanelScore.find(
    { application_id: { $in: live.map((a) => a.application_id._id) } },
    'application_id round'
  );
  const doneByApp = new Map();
  for (const s of scores) {
    const k = String(s.application_id);
    if (!doneByApp.has(k)) doneByApp.set(k, new Set());
    doneByApp.get(k).add(s.round || 1);
  }

  res.json({
    assignments: live
      .map((a) => ({
        id: a._id,
        application_id: a.application_id._id,
        round: a.round,
        panel_role: a.panel_role,
        status: a.status, // Pending | Scored
        // false while an earlier round is still outstanding
        unlocked: [...Array(a.round - 1).keys()]
          .every((i) => (doneByApp.get(String(a.application_id._id)) || new Set()).has(i + 1)),
        assigned_at: a.assigned_at,
        candidate_name: a.application_id.candidate_name,
        designation: a.application_id.designation,
        job_code: a.application_id.job_code,
        grade: a.application_id.grade,
        department: a.application_id.department,
        stage: a.application_id.stage,
        interview_date: a.application_id.interview_date,
      })),
  });
});

// GET /api/interviewer/applications/:id — candidate detail + resolved scoring form
router.get('/applications/:id', async (req, res) => {
  const mine = await myAssignments(req, req.params.id);
  if (!mine.length) return res.status(403).json({ error: 'You are not on this candidate\'s panel' });
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const competencies = await resolveCompetencies(app.competency_profile);
  const allScores = await PanelScore.find({ application_id: app._id });
  const scoredRounds = new Set(allScores.map((s) => s.round || 1));
  const gate = openRoundFor(mine, scoredRounds, req.query.round);
  const myScore = allScores.find(
    (s) => String(s.panelist_user_id) === String(req.user._id) && s.round === (gate.assignment?.round)
  );
  const rounds = await roundsForGrade(app.grade);

  res.json({
    application: {
      id: app._id,
      candidate_name: app.candidate_name,
      designation: app.designation,
      job_code: app.job_code,
      grade: app.grade,
      department: app.department,
      job_family: app.job_family,
      stage: app.stage,
      interview_date: app.interview_date,
      age: app.age,
      gender: app.gender,
      qualification: app.qualification,
      total_experience_years: app.total_experience_years,
      current_designation: app.current_designation,
      years_in_current_firm: app.years_in_current_firm,
      intro_note: app.intro_note,
      why_join: app.why_join,
      documents: app.documents,
    },
    panel: {
      rounds,
      size: rounds,                       // retained for existing clients
      committee: rounds === 3,
      my_rounds: mine.map((a) => a.round),
      my_role: gate.assignment?.panel_role || mine[0].panel_role,
      // The round this interviewer may score right now, null while an earlier one is open.
      active_round: gate.round,
      locked_reason: gate.error,
      rounds_completed: [...scoredRounds].sort((a, b) => a - b),
    },
    levels: LEVELS,
    competencies: competencies.map((c) => ({
      key: c.key, name: c.name, section: c.section, weight: c.weight,
      anchors: c.anchors, is_placeholder: c.is_placeholder,
    })),
    my_score: myScore ? {
      total_score: myScore.total_score,
      red_flags: myScore.red_flags,
      evidence_notes: myScore.evidence_notes,
      strengths: myScore.strengths,
      concerns: myScore.concerns,
      competency_breakdown: myScore.competency_breakdown,
      submitted_at: myScore.submitted_at,
    } : null,
  });
});

// POST /api/interviewer/applications/:id/score
// { competency_selections: [{ key, level_index }], evidence_notes, strengths, concerns, red_flags }
// Points are computed SERVER-SIDE from the competency library — the client's math is never trusted.
router.post('/applications/:id/score', async (req, res) => {
  const mine = await myAssignments(req, req.params.id);
  if (!mine.length) return res.status(403).json({ error: 'You are not on this candidate\'s panel' });
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.stage !== 'Interview Scheduled') {
    return res.status(400).json({ error: `Scoring unlocks when HR sets the stage to Interview Scheduled (currently: ${app.stage})` });
  }

  const {
    competency_selections = [], evidence_notes = '', strengths = '', concerns = '',
    red_flags = [], round: requestedRound,
  } = req.body || {};

  // Rounds are sequential: refuse a later round while an earlier one is unscored.
  const scoredRounds = new Set(
    (await PanelScore.find({ application_id: app._id }, 'round')).map((s) => s.round || 1)
  );
  const gate = openRoundFor(mine, scoredRounds, requestedRound);
  if (gate.error) return res.status(gate.assignment ? 400 : 403).json({ error: gate.error });
  const assignment = gate.assignment;
  const competencies = await resolveCompetencies(app.competency_profile);
  const selByKey = Object.fromEntries(competency_selections.map((s) => [s.key, s.level_index]));

  let rawTotal = 0;
  const breakdown = [];
  for (const c of competencies) {
    const li = selByKey[c.key];
    if (li === undefined || li === null || li < 0 || li > 4) {
      return res.status(400).json({ error: `Every competency must be scored — missing: ${c.name}` });
    }
    rawTotal += c.weight * LEVELS[li].pct;
    breakdown.push({
      competency_key: c.key, name: c.name, section: c.section, weight: c.weight,
      level_index: li, level_label: LEVELS[li].label,
      points: Math.round(c.weight * LEVELS[li].pct),
    });
  }
  const total = Math.round(rawTotal);

  const score = await PanelScore.findOneAndUpdate(
    { application_id: app._id, round: assignment.round },
    {
      panelist_user_id: req.user._id,
      panelist_name: req.user.name,
      panel_role: assignment.panel_role,
      competency_breakdown: breakdown,
      total_score: total,
      evidence_notes, strengths, concerns,
      red_flags: Array.isArray(red_flags) ? red_flags : [],
      submitted_at: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  assignment.status = 'Scored';
  await assignment.save();

  const totalRounds = await roundsForGrade(app.grade);
  scoredRounds.add(assignment.round);
  res.status(201).json({
    score: {
      round: assignment.round,
      total_score: score.total_score,
      recommendation: recommendation(score.total_score),
      red_flags: score.red_flags,
    },
    next_round: scoredRounds.size >= totalRounds ? null : assignment.round + 1,
  });
});

export default router;
