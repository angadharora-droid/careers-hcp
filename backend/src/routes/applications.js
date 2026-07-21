import { Router } from 'express';
import mongoose from 'mongoose';
import Application, { STAGES, REJECTION_REASONS } from '../models/Application.js';
import Position from '../models/Position.js';
import PanelAssignment from '../models/PanelAssignment.js';
import PanelScore from '../models/PanelScore.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  RECRUITABLE_STATUSES, recruitable, roundsForGrade, scoreSummary, wordCount,
  applyPanelRule, resolvePanelRule,
} from '../utils/helpers.js';
import { buildOfferLetter } from '../utils/offerLetter.js';
import { isEmailConfigured, sendMail } from '../utils/mailer.js';

const router = Router();
router.use(requireAuth);

async function withDerived(app) {
  const [scores, assignments, rounds] = await Promise.all([
    PanelScore.find({ application_id: app._id }),
    PanelAssignment.find({ application_id: app._id }).populate('interviewer_user_id', 'name email department designation'),
    roundsForGrade(app.grade),
  ]);
  const o = app.toObject({ versionKey: false });
  o.id = o._id;
  o.rounds = rounds;
  o.panel_size = rounds; // retained for existing clients
  o.score_summary = scoreSummary(scores, rounds);
  o.panel_assignments = assignments
    .sort((a, b) => a.round - b.round)
    .map((a) => ({
      id: a._id,
      round: a.round,
      interviewer: a.interviewer_user_id
        ? { id: a.interviewer_user_id._id, name: a.interviewer_user_id.name, department: a.interviewer_user_id.department, designation: a.interviewer_user_id.designation }
        : null,
      panel_role: a.panel_role,
      status: a.status,
      auto_assigned: a.auto_assigned,
      assigned_at: a.assigned_at,
    }));
  return o;
}

/* ===== HR: list / detail ===== */

// GET /api/applications?stage=&q=&red_flag=true
router.get('/', requireRole('hr_admin'), async (req, res) => {
  const { stage, q, red_flag } = req.query;
  const filter = {};
  if (stage) filter.stage = stage;
  if (q) filter.$or = [
    { candidate_name: { $regex: q, $options: 'i' } },
    { job_code: { $regex: q, $options: 'i' } },
    { reference_id: { $regex: q, $options: 'i' } },
  ];
  if (red_flag === 'true') {
    // Red-flag queue: any panellist raised a flag → HR review regardless of total
    const flaggedIds = await PanelScore.distinct('application_id', { 'red_flags.0': { $exists: true } });
    filter._id = { $in: flaggedIds };
  }
  const apps = await Application.find(filter).sort('-applied_on');
  res.json({ applications: await Promise.all(apps.map(withDerived)) });
});

router.get('/:id', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  res.json({ application: await withDerived(app) });
});

// PATCH /api/applications/:id — edit candidate fields (not stage; use /stage)
router.patch('/:id', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const b = { ...req.body };
  ['stage', 'position_id', 'pcn', 'reference_id', '_id'].forEach((k) => delete b[k]);
  if (b.intro_note !== undefined && wordCount(b.intro_note) > 50) {
    return res.status(400).json({ error: 'Brief intro must be 50 words or fewer' });
  }
  Object.assign(app, b);
  await app.save();
  res.json({ application: await withDerived(app) });
});

// DELETE /api/applications/:id
router.delete('/:id', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findByIdAndDelete(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  await PanelAssignment.deleteMany({ application_id: app._id });
  await PanelScore.deleteMany({ application_id: app._id });
  res.json({ ok: true });
});

/* ===== HR: stage transitions (server-side recruitment gate) ===== */

// PATCH /api/applications/:id/stage
// { stage, rejection_reason?, interview_date?, date_of_joining?, offered_salary?, position_id?, allow_partial_panel? }
router.patch('/:id/stage', requireRole('hr_admin'), async (req, res) => {
  const {
    stage, rejection_reason, interview_date, date_of_joining, offered_salary,
    position_id, allow_partial_panel,
  } = req.body || {};
  if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  if (stage === 'Rejected') {
    const reason = String(rejection_reason || '').trim();
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    if (!REJECTION_REASONS.includes(reason)) {
      return res.status(400).json({ error: `Rejection reason must be one of: ${REJECTION_REASONS.join('; ')}` });
    }
    app.rejection_reason = reason;
  }
  if (stage === 'Interview Scheduled') {
    app.interview_date = String(interview_date || '').trim();
    // Lay down the fixed panel from Interview_Panel.xlsx. Silent when no rule covers
    // this unit/grade/department — HR then assigns by hand as before.
    await applyPanelRule(app, { assignedBy: req.user._id });
  }

  if (stage === 'Selected') {
    // Gate 1: every round must have been scored (2 or 3 depending on grade).
    const rounds = await roundsForGrade(app.grade);
    const scores = await PanelScore.find({ application_id: app._id });
    if (scores.length < rounds) {
      if (!allow_partial_panel || scores.length === 0) {
        return res.status(400).json({
          error: `Recruitment gate: only ${scores.length}/${rounds} interview rounds are complete. ` +
            (scores.length === 0
              ? 'At least one round must be scored.'
              : 'Pass allow_partial_panel:true to override deliberately.'),
        });
      }
    }
    // Gate 2: the target seat must be Vacant / Under Recruitment. Seat is chosen
    // now (selection time), not at apply time — candidate applied to the role.
    // designation is matched too: if two designations ever share a job_code,
    // a candidate can still only fill a seat of the role they applied for.
    const seatFilter = position_id
      ? { _id: position_id, job_code: app.job_code, designation: app.designation, status: { $in: RECRUITABLE_STATUSES } }
      : { job_code: app.job_code, designation: app.designation, status: { $in: RECRUITABLE_STATUSES } };
    // Atomic claim of the seat: filter includes the recruitable check, so a
    // concurrent selection cannot double-fill the same PCN.
    const seat = await Position.findOneAndUpdate(
      seatFilter,
      { status: 'Filled', occupant_name: app.candidate_name, vacant_since: null },
      { new: true, sort: { pcn: 1 } }
    );
    if (!seat) {
      return res.status(400).json({
        error: 'Recruitment gate CLOSED: no seat under this job code is Vacant or Under Recruitment.',
      });
    }
    try {
      app.stage = 'Selected';
      app.position_id = seat._id;
      app.pcn = seat.pcn;
      // Optional offer terms captured alongside selection (editable later via /offer).
      if (date_of_joining !== undefined) app.date_of_joining = String(date_of_joining || '').trim();
      if (offered_salary !== undefined && offered_salary !== null && offered_salary !== '') {
        app.offered_salary = Number(offered_salary);
      }
      await app.save();
    } catch (err) {
      // Roll the seat back so position + application can't desync.
      await Position.findByIdAndUpdate(seat._id, {
        status: 'Under Recruitment', occupant_name: '', vacant_since: null,
      });
      return res.status(500).json({ error: 'Selection failed, position rolled back: ' + err.message });
    }
    return res.json({ application: await withDerived(app), filled_pcn: seat.pcn });
  }

  // If a previously Selected candidate is moved back out, release their seat.
  if (app.stage === 'Selected' && stage !== 'Selected' && app.position_id) {
    await Position.findByIdAndUpdate(app.position_id, {
      status: 'Under Recruitment', occupant_name: '', vacant_since: null,
    });
    app.position_id = null;
    app.pcn = '';
  }

  app.stage = stage;
  await app.save();
  res.json({ application: await withDerived(app) });
});

/* ===== HR: offer letter (date of joining, salary, generate, email) ===== */

// Returns an error string if the candidate isn't ready for an offer letter, else null.
function offerReady(app) {
  if (app.stage !== 'Selected' || !app.pcn) {
    return 'Offer letter is available only after the candidate is Selected into a seat.';
  }
  if (!app.date_of_joining) return 'Set the date of joining before generating the offer letter.';
  if (app.offered_salary == null) return 'Set the offered salary before generating the offer letter.';
  return null;
}

async function offerLetterFor(app, opts = {}) {
  const position = app.position_id ? await Position.findById(app.position_id) : null;
  return buildOfferLetter(app, { position, ...opts });
}

// PATCH /api/applications/:id/offer — set/adjust offer terms after selection
// { date_of_joining?, offered_salary? }
router.patch('/:id/offer', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.stage !== 'Selected') {
    return res.status(400).json({ error: 'Offer terms can only be set for a Selected candidate' });
  }
  const { date_of_joining, offered_salary } = req.body || {};
  if (date_of_joining !== undefined) app.date_of_joining = String(date_of_joining || '').trim();
  if (offered_salary !== undefined) {
    if (offered_salary === null || offered_salary === '') {
      app.offered_salary = null;
    } else {
      const n = Number(offered_salary);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Offered salary must be a non-negative number' });
      app.offered_salary = n;
    }
  }
  await app.save();
  res.json({ application: await withDerived(app) });
});

// GET /api/applications/:id/offer-letter — printable HTML offer letter
router.get('/:id/offer-letter', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const gate = offerReady(app);
  if (gate) return res.status(400).json({ error: gate });
  const html = await offerLetterFor(app, { forEmail: false });
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// POST /api/applications/:id/send-offer — email the offer letter to the candidate
// { to? }  → falls back to app.email
router.post('/:id/send-offer', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const gate = offerReady(app);
  if (gate) return res.status(400).json({ error: gate });
  if (!isEmailConfigured()) {
    return res.status(400).json({
      error: 'Server email (SMTP) is not configured. Set SMTP_* in backend/.env, or send from your own mail client.',
      email_configured: false,
    });
  }
  const to = String((req.body || {}).to || app.email || '').trim();
  if (!to) return res.status(400).json({ error: 'Candidate has no email address on file' });
  const html = await offerLetterFor(app, { forEmail: true });
  try {
    await sendMail({ to, subject: `Offer of Employment — ${app.designation}, Centre Point Amravati`, html });
  } catch (e) {
    if (e.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(400).json({ error: e.message, email_configured: false });
    }
    return res.status(502).json({ error: 'Could not send email: ' + e.message });
  }
  app.offer_sent_at = new Date();
  app.offer_sent_to = to;
  await app.save();
  res.json({ application: await withDerived(app), sent_to: to });
});

/* ===== HR: interviewer appointment ===== */

// POST /api/applications/:id/assign-panel  { assignments: [{ interviewer_user_id, round }] }
// Overrides the fixed panel. One interviewer MAY hold several rounds — the workbook
// puts the same person in Round 1 and Round 3 on every A-grade row.
router.post('/:id/assign-panel', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const list = (req.body || {}).assignments || [];
  const rounds = await roundsForGrade(app.grade);
  if (list.length < 1 || list.length > rounds) {
    return res.status(400).json({ error: `This grade runs ${rounds} interview rounds (got ${list.length})` });
  }

  // Accept a bare list (round inferred from order) or explicit round numbers.
  const slots = list.map((a, i) => ({ interviewer_user_id: a.interviewer_user_id, round: Number(a.round) || i + 1 }));
  const roundNos = slots.map((s) => s.round);
  if (roundNos.some((n) => !Number.isInteger(n) || n < 1 || n > rounds)) {
    return res.status(400).json({ error: `Round numbers must be between 1 and ${rounds}` });
  }
  if (new Set(roundNos).size !== roundNos.length) {
    return res.status(400).json({ error: 'Two panellists cannot hold the same round' });
  }

  const ids = [...new Set(slots.map((s) => String(s.interviewer_user_id)))];
  const users = await User.find({ _id: { $in: ids }, roles: 'interviewer' });
  if (users.length !== ids.length) {
    return res.status(400).json({ error: 'All panellists must be registered interviewer accounts' });
  }

  // Replace semantics: drop Pending rounds not in the new list (Scored ones stay).
  const existing = await PanelAssignment.find({ application_id: app._id });
  for (const ex of existing) {
    if (!roundNos.includes(ex.round)) {
      if (ex.status === 'Scored') {
        return res.status(400).json({ error: `Cannot remove round ${ex.round} — it has already been scored` });
      }
      await ex.deleteOne();
    }
  }
  for (const s of slots) {
    const held = existing.find((e) => e.round === s.round);
    if (held?.status === 'Scored' && String(held.interviewer_user_id) !== String(s.interviewer_user_id)) {
      return res.status(400).json({ error: `Round ${s.round} has already been scored — reassign it only after clearing that score` });
    }
    await PanelAssignment.findOneAndUpdate(
      { application_id: app._id, round: s.round },
      {
        interviewer_user_id: s.interviewer_user_id,
        panel_role: `Round ${s.round}`,
        assigned_by: req.user._id,
        auto_assigned: false,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  res.json({ application: await withDerived(app) });
});

// POST /api/applications/:id/apply-panel-rule — (re)apply the fixed panel from the
// workbook, e.g. after HR has fiddled with it. { replace?: true } overwrites
// unscored manual picks; scored rounds are never touched.
router.post('/:id/apply-panel-rule', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const { applied, rule } = await applyPanelRule(app, {
    assignedBy: req.user._id,
    replace: Boolean((req.body || {}).replace),
  });
  if (!rule) {
    return res.status(404).json({
      error: `No fixed panel is defined for ${app.unit_code} / grade ${app.grade} / ${app.department}. Assign the panel manually.`,
    });
  }
  res.json({ application: await withDerived(app), rounds_applied: applied });
});

// GET /api/applications/:id/panel-rule — preview the fixed panel without writing it
router.get('/:id/panel-rule', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const rule = await resolvePanelRule(app.unit_code, app.grade, app.department);
  if (!rule) return res.json({ rule: null });
  await rule.populate([
    { path: 'rounds.interviewer_user_id', select: 'name email designation department' },
    { path: 'rounds.alternates', select: 'name email designation department' },
  ]);
  res.json({
    rule: {
      unit_code: rule.unit_code,
      grade: rule.grade,
      department: rule.department,
      dept_code: rule.dept_code,
      rounds: rule.rounds.map((s) => ({
        round: s.round,
        interviewer: s.interviewer_user_id,
        alternates: s.alternates,
      })),
    },
  });
});

/* ===== Shared read: panel comparison (HR + assigned interviewers) ===== */

// GET /api/applications/:id/scores
router.get('/:id/scores', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Application not found' });
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  // HR sees every score; a dual-role user reading as HR must not be forced down
  // the panellist path just because 'interviewer' happens to be their primary role.
  if (!req.user.hasRole('hr_admin')) {
    const assigned = await PanelAssignment.findOne({
      application_id: app._id, interviewer_user_id: req.user._id,
    });
    if (!assigned) return res.status(403).json({ error: 'You are not on this candidate\'s panel' });
  }
  const scores = await PanelScore.find({ application_id: app._id }).sort('round');
  const rounds = await roundsForGrade(app.grade);
  res.json({
    candidate_name: app.candidate_name,
    designation: app.designation,
    job_code: app.job_code,
    grade: app.grade,
    stage: app.stage,
    rounds,
    summary: scoreSummary(scores, rounds),
    scores: scores.map((s) => ({
      id: s._id,
      round: s.round,
      panelist_name: s.panelist_name,
      panel_role: s.panel_role,
      total_score: s.total_score,
      red_flags: s.red_flags,
      evidence_notes: s.evidence_notes,
      strengths: s.strengths,
      concerns: s.concerns,
      competency_breakdown: s.competency_breakdown,
      submitted_at: s.submitted_at,
    })),
  });
});

export default router;
