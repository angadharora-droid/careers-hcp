import { Router } from 'express';
import PanelAssignment from '../models/PanelAssignment.js';
import PanelScore from '../models/PanelScore.js';
import Application from '../models/Application.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  LEVELS, panelSizeForGrade, resolveCompetencies, recommendation,
} from '../utils/helpers.js';

const router = Router();
router.use(requireAuth, requireRole('interviewer'));

async function myAssignment(req, applicationId) {
  return PanelAssignment.findOne({
    application_id: applicationId,
    interviewer_user_id: req.user._id,
  });
}

// GET /api/interviewer/assignments — ONLY this interviewer's queue
router.get('/assignments', async (req, res) => {
  const assignments = await PanelAssignment.find({ interviewer_user_id: req.user._id })
    .sort('-assigned_at')
    .populate('application_id');
  res.json({
    assignments: assignments
      .filter((a) => a.application_id) // application may have been deleted
      .map((a) => ({
        id: a._id,
        application_id: a.application_id._id,
        panel_role: a.panel_role,
        status: a.status, // Pending | Scored
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
  const assignment = await myAssignment(req, req.params.id);
  if (!assignment) return res.status(403).json({ error: 'You are not on this candidate\'s panel' });
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const competencies = await resolveCompetencies(app.competency_profile);
  const myScore = await PanelScore.findOne({ application_id: app._id, panelist_user_id: req.user._id });
  const panelSize = await panelSizeForGrade(app.grade);

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
    panel: { size: panelSize, committee: panelSize === 3, my_role: assignment.panel_role },
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
  const assignment = await myAssignment(req, req.params.id);
  if (!assignment) return res.status(403).json({ error: 'You are not on this candidate\'s panel' });
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.stage !== 'Interview Scheduled') {
    return res.status(400).json({ error: `Scoring unlocks when HR sets the stage to Interview Scheduled (currently: ${app.stage})` });
  }

  const { competency_selections = [], evidence_notes = '', strengths = '', concerns = '', red_flags = [] } = req.body || {};
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
    { application_id: app._id, panelist_user_id: req.user._id },
    {
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

  res.status(201).json({
    score: { total_score: score.total_score, recommendation: recommendation(score.total_score), red_flags: score.red_flags },
  });
});

export default router;
