import { Router } from 'express';
import mongoose from 'mongoose';
import Application, { STAGES, REJECTION_REASONS } from '../models/Application.js';
import Position from '../models/Position.js';
import PanelAssignment from '../models/PanelAssignment.js';
import PanelScore from '../models/PanelScore.js';
import ApplicationComment from '../models/ApplicationComment.js';
import ApplicationEvent, { recordEvent } from '../models/ApplicationEvent.js';
import CandidateDocument from '../models/CandidateDocument.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  RECRUITABLE_STATUSES, recruitable, roundsForGrade, scoreSummary, wordCount,
  applyPanelRule, resolvePanelRule, daysToFill, bandStanding,
} from '../utils/helpers.js';
import { buildOfferLetter } from '../utils/offerLetter.js';
import { isEmailConfigured, sendMail } from '../utils/mailer.js';
import { documentUpload, saveCandidateDocuments, deleteCandidateDocuments } from '../utils/uploads.js';

const router = Router();
router.use(requireAuth);

/* Field keys as a person would name them, for the timeline's edit entries.
   Anything not listed falls back to its key with the underscores knocked out,
   which reads well enough for the rarer fields. */
const FIELD_LABELS = {
  current_employer: 'Current / last employer',
  relevant_hotel_experience_years: 'Relevant hotel experience',
  notice_period: 'Notice period',
  remarks: 'Remarks',
  candidate_name: 'Candidate name',
  total_experience_years: 'Total experience',
  current_salary: 'Current salary',
  expected_salary: 'Expected salary',
  current_designation: 'Current designation',
  years_in_current_firm: 'Years in current firm',
  intro_note: 'Brief intro',
  why_join: 'Why join',
  worked_at_cph_before: 'Worked at CPH before',
  willing_to_relocate: 'Willing to relocate',
  needs_accommodation: 'Needs accommodation',
};
const fieldLabel = (k) => FIELD_LABELS[k] || String(k).replace(/_/g, ' ');

async function withDerived(app) {
  const [scores, assignments, rounds, commentCount, seat] = await Promise.all([
    PanelScore.find({ application_id: app._id }),
    PanelAssignment.find({ application_id: app._id }).populate('interviewer_user_id', 'name email department designation'),
    roundsForGrade(app.grade),
    ApplicationComment.countDocuments({ application_id: app._id }),
    app.position_id ? Position.findById(app.position_id, 'salary_min salary_max') : null,
  ]);
  const o = app.toObject({ versionKey: false });
  o.id = o._id;
  o.comment_count = commentCount;
  /* Where the actual offer sits against the seat's sanctioned band. Only a
     Selected candidate holds a seat, so this is null everywhere else. */
  o.salary_band = seat ? { min: seat.salary_min, max: seat.salary_max } : null;
  o.band_standing = seat ? bandStanding(app.offered_salary, seat.salary_min, seat.salary_max) : null;
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

// GET /api/applications?stage=&q=&department=&job_code=&grade=&red_flag=true
router.get('/', requireRole('hr_admin'), async (req, res) => {
  const { stage, q, red_flag, department, job_code, grade } = req.query;
  const filter = {};
  if (stage) filter.stage = stage;
  if (department) filter.department = department;
  if (job_code) filter.job_code = job_code;
  if (grade) filter.grade = grade;
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
  /* Which fields this edit actually changes, captured before the assign — the
     register's Section A cells write through here, so "who changed the remarks"
     has to be answerable. Unchanged keys are dropped so a re-save of the same
     value does not litter the timeline. */
  const changed = Object.keys(b).filter((k) => {
    const before = app[k];
    const after = b[k];
    if (before == null && after == null) return false;
    return String(before ?? '') !== String(after ?? '');
  });

  Object.assign(app, b);
  await app.save();
  if (changed.length) {
    await recordEvent(app._id, 'edit', 'Candidate details edited', {
      actor: req.user,
      detail: changed.map(fieldLabel).join(', '),
    });
  }
  res.json({ application: await withDerived(app) });
});

// DELETE /api/applications/:id
router.delete('/:id', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findByIdAndDelete(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  await PanelAssignment.deleteMany({ application_id: app._id });
  await PanelScore.deleteMany({ application_id: app._id });
  await deleteCandidateDocuments(app.documents);
  res.json({ ok: true });
});

// POST /api/applications/:id/documents — multipart, files under "documents".
// Lets HR attach documents a candidate sent directly (e.g. a CV resent after the
// original upload was lost from local disk in a pre-database-storage redeploy).
router.post('/:id/documents', requireRole('hr_admin'), documentUpload.array('documents', 6), async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (!req.files?.length) return res.status(400).json({ error: 'Attach at least one PDF' });
    if (app.documents.length + req.files.length > 6) {
      return res.status(400).json({ error: `An application holds at most 6 documents (this one has ${app.documents.length})` });
    }
    const added = await saveCandidateDocuments(req.files);
    app.documents.push(...added);
    await app.save();
    await recordEvent(app._id, 'document', `${added.length} document(s) attached`, {
      actor: req.user,
      detail: added.map((d) => d.original_name).filter(Boolean).join(', '),
    });
    res.json({ application: await withDerived(app) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
    // Either a standard reason, or "Other: <free text>" written by HR.
    const isOther = /^Other:\s*\S/.test(reason);
    if (!REJECTION_REASONS.includes(reason) && !isOther) {
      return res.status(400).json({ error: `Rejection reason must be one of: ${REJECTION_REASONS.join('; ')} — or "Other: <reason>"` });
    }
    if (reason.length > 300) {
      return res.status(400).json({ error: 'Rejection reason must be 300 characters or fewer' });
    }
    app.rejection_reason = reason;
  }
  if (stage === 'Interview Scheduled') {
    app.interview_date = String(interview_date || '').trim();
    // Lay down the fixed panel from Interview_Panel.xlsx. Silent when no rule covers
    // this unit/grade/department — HR then assigns by hand as before.
    const { applied: panelRounds } = await applyPanelRule(app, { assignedBy: req.user._id });
    if (panelRounds) {
      await recordEvent(app._id, 'panel', `Standing panel appointed — ${panelRounds} round(s)`, { actor: req.user });
    }
  }

  // The stage the application is leaving, captured before anything overwrites it.
  const priorStage = app.stage;

  if (stage === 'Selected') {
    /* Already Selected and holding the same seat? Then this is an offer edit, not a
       fresh selection. Falling through would claim a SECOND seat and strand the
       first as Filled with no application pointing at it — nothing can ever release
       it again, and the register shows the occupant twice. */
    if (app.stage === 'Selected' && app.position_id
        && (!position_id || String(position_id) === String(app.position_id))) {
      if (date_of_joining !== undefined) app.date_of_joining = String(date_of_joining || '').trim();
      if (offered_salary !== undefined && offered_salary !== null && offered_salary !== '') {
        app.offered_salary = Number(offered_salary);
      }
      await app.save();
      const held = await Position.findById(app.position_id);
      return res.json({ application: await withDerived(app), filled_pcn: held?.pcn || app.pcn });
    }
    // Moving an existing selection to a different seat — the old one is freed below,
    // once the new claim and the application save have both gone through.
    const previousSeatId = app.stage === 'Selected' ? app.position_id : null;

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
    /* Atomic claim of the seat: filter includes the recruitable check, so a
       concurrent selection cannot double-fill the same PCN. `new: false` returns
       the PRE-claim document, which is the only place vacant_since still holds a
       value — the update clears it, and time-to-fill is measured from it. */
    const seat = await Position.findOneAndUpdate(
      seatFilter,
      { status: 'Filled', occupant_name: app.candidate_name, vacant_since: null },
      { new: false, sort: { pcn: 1 } }
    );
    if (!seat) {
      return res.status(400).json({
        error: 'Recruitment gate CLOSED: no seat under this job code is Vacant or Under Recruitment.',
      });
    }
    /* Stamp how long the seat took to fill. A second write, but the seat is
       already claimed by now, so nothing can race it — and it keeps the claim
       itself a single atomic compare-and-set. */
    const filledOn = new Date();
    await Position.findByIdAndUpdate(seat._id, {
      filled_on: filledOn,
      days_to_fill: daysToFill(seat.vacant_since, filledOn),
    });
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
      // Roll the seat back so position + application can't desync — including
      // the time-to-fill stamps written just above, for a fill that did not stick.
      await Position.findByIdAndUpdate(seat._id, {
        status: 'Under Recruitment', occupant_name: '', vacant_since: seat.vacant_since,
        filled_on: null, days_to_fill: null,
      });
      return res.status(500).json({ error: 'Selection failed, position rolled back: ' + err.message });
    }
    // Hand back the seat this candidate used to hold, so they never occupy two.
    if (previousSeatId && String(previousSeatId) !== String(seat._id)) {
      await Position.findByIdAndUpdate(previousSeatId, {
        status: 'Under Recruitment', occupant_name: '', vacant_since: new Date(),
        filled_on: null, days_to_fill: null,
      });
    }
    await recordEvent(app._id, 'stage', 'Selected', {
      actor: req.user,
      from: priorStage,
      to: 'Selected',
      detail: `Seat ${seat.pcn} filled${app.offered_salary != null ? ` · offered ${app.offered_salary}` : ''}`,
    });
    return res.json({ application: await withDerived(app), filled_pcn: seat.pcn });
  }

  // If a previously Selected candidate is moved back out, release their seat.
  if (app.stage === 'Selected' && stage !== 'Selected' && app.position_id) {
    await Position.findByIdAndUpdate(app.position_id, {
        status: 'Under Recruitment', occupant_name: '', vacant_since: new Date(),
        filled_on: null, days_to_fill: null,
      });
    app.position_id = null;
    app.pcn = '';
  }

  app.stage = stage;
  await app.save();
  if (priorStage !== stage) {
    await recordEvent(app._id, 'stage', stage, {
      actor: req.user,
      from: priorStage,
      to: stage,
      detail: stage === 'Rejected'
        ? app.rejection_reason
        : (stage === 'Interview Scheduled' && app.interview_date ? `Interview on ${app.interview_date}` : ''),
    });
  }
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
  await recordEvent(app._id, 'offer', 'Offer terms updated', {
    actor: req.user,
    detail: [
      app.offered_salary != null ? `Salary ${app.offered_salary}` : null,
      app.date_of_joining ? `Joining ${app.date_of_joining}` : null,
    ].filter(Boolean).join(' · '),
  });
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
  await recordEvent(app._id, 'offer', 'Offer letter emailed', { actor: req.user, detail: to });
  res.json({ application: await withDerived(app), sent_to: to });
});

/* ===== HR: Application Register — Section B approval record ===== */

// PATCH /api/applications/:id/approval
// { recommended_by?, salary_approved_by?, approval_date?, offer_issued_date?,
//   employee_code?, closed_by? }
// Records who recommended, who approved the salary and when.
router.patch('/:id/approval', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.stage !== 'Selected') {
    return res.status(400).json({ error: 'The approval record applies only to a Selected candidate' });
  }
  const b = req.body || {};
  const text = (v, max, label) => {
    const t = String(v ?? '').trim();
    if (t.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
    return t;
  };
  const date = (v, label) => {
    const t = String(v ?? '').trim();
    if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error(`${label} must be a date (YYYY-MM-DD)`);
    return t;
  };

  const next = { ...(app.approval?.toObject?.() || app.approval || {}) };
  try {
    if (b.recommended_by !== undefined) next.recommended_by = text(b.recommended_by, 120, 'Recommended by');
    if (b.salary_approved_by !== undefined) next.salary_approved_by = text(b.salary_approved_by, 120, 'Salary approved by');
    if (b.employee_code !== undefined) next.employee_code = text(b.employee_code, 40, 'Employee code');
    if (b.closed_by !== undefined) next.closed_by = text(b.closed_by, 120, 'Application closed by');
    if (b.approval_date !== undefined) next.approval_date = date(b.approval_date, 'Approval date');
    if (b.offer_issued_date !== undefined) next.offer_issued_date = date(b.offer_issued_date, 'Offer issued date');
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  /* No offer letter before position AND salary approval. The seat
     is already proven by stage Selected (it claimed a PCN); the salary approval is
     what this record adds, so an offer issue date cannot predate it. */
  if (next.offer_issued_date) {
    if (!next.salary_approved_by || !next.approval_date) {
      return res.status(400).json({
        error: 'Record the salary approving authority and approval date before entering an offer issued date.',
      });
    }
    if (app.offered_salary == null) {
      return res.status(400).json({ error: 'Set the offered salary before entering an offer issued date.' });
    }
    if (next.offer_issued_date < next.approval_date) {
      return res.status(400).json({ error: 'The offer cannot be issued before the approval date.' });
    }
  }
  // The employee code closes the loop from application to hire,
  // so it only exists once an offer has actually gone out.
  if (next.employee_code && !next.offer_issued_date) {
    return res.status(400).json({ error: 'Record the offer issued date before the employee code.' });
  }

  app.approval = next;
  await app.save();
  await recordEvent(app._id, 'approval', 'Approval record saved', {
    actor: req.user,
    detail: [
      next.recommended_by ? `Recommended by ${next.recommended_by}` : null,
      next.salary_approved_by ? `Salary approved by ${next.salary_approved_by}` : null,
      next.approval_date ? `on ${next.approval_date}` : null,
      next.offer_issued_date ? `Offer issued ${next.offer_issued_date}` : null,
      next.employee_code ? `Employee code ${next.employee_code}` : null,
    ].filter(Boolean).join(' · '),
  });
  res.json({ application: await withDerived(app) });
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
    return res.status(400).json({ error: `Panel numbers must be between 1 and ${rounds}` });
  }
  if (new Set(roundNos).size !== roundNos.length) {
    return res.status(400).json({ error: 'Two panellists cannot hold the same round' });
  }

  const ids = [...new Set(slots.map((s) => String(s.interviewer_user_id)))];
  const users = await User.find({ _id: { $in: ids }, roles: 'interviewer' });
  if (users.length !== ids.length) {
    return res.status(400).json({ error: 'All panellists must be registered interviewer accounts' });
  }
  const existing = await PanelAssignment.find({ application_id: app._id });

  /* Any registered interviewer account may be appointed. The fixed matrix and the
     department roster only rank the picker's SUGGESTIONS — HR can search the whole
     directory when the name it wants is not among them. The guards that matter
     stay: registered interviewer accounts only (above), and scored rounds are
     immutable (below). */

  for (const ex of existing) {
    if (!roundNos.includes(ex.round)) {
      if (ex.status === 'Scored') {
        return res.status(400).json({ error: `Cannot remove panel ${ex.round} — it has already been scored` });
      }
      await ex.deleteOne();
    }
  }
  for (const s of slots) {
    const held = existing.find((e) => e.round === s.round);
    if (held?.status === 'Scored' && String(held.interviewer_user_id) !== String(s.interviewer_user_id)) {
      return res.status(400).json({ error: `Panel ${s.round} has already been scored — reassign it only after clearing that score` });
    }
    await PanelAssignment.findOneAndUpdate(
      { application_id: app._id, round: s.round },
      {
        interviewer_user_id: s.interviewer_user_id,
        panel_role: `Panel ${s.round}`,
        assigned_by: req.user._id,
        auto_assigned: false,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  await recordEvent(app._id, 'panel', 'Interview panel appointed by hand', {
    actor: req.user,
    detail: users.map((u) => u.name).join(', '),
  });
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
  await recordEvent(app._id, 'panel', `Standing panel re-applied — ${applied} round(s)`, {
    actor: req.user,
    detail: (req.body || {}).replace ? 'Unscored manual picks overwritten' : '',
  });
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

/* ===== Shared thread: comments (HR + assigned interviewers, both ways) ===== */

/* Same access rule as the scores read: HR sees every application, an interviewer
   only the candidates they were appointed to. Returns the application, or null
   when this user has no business reading it. */
async function readableApplication(req, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const app = await Application.findById(id);
  if (!app) return null;
  if (req.user.hasRole('hr_admin')) return app;
  const assigned = await PanelAssignment.findOne({
    application_id: app._id, interviewer_user_id: req.user._id,
  });
  return assigned ? app : null;
}

const commentJSON = (c) => ({
  id: c._id,
  author: { id: c.author_user_id, name: c.author_name, role: c.author_role, designation: c.author_designation },
  body: c.body,
  created_at: c.created_at,
});

// GET /api/applications/:id/comments — oldest first, the way a thread reads
router.get('/:id/comments', async (req, res) => {
  const app = await readableApplication(req, req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const comments = await ApplicationComment.find({ application_id: app._id }).sort('created_at');
  res.json({ comments: comments.map(commentJSON) });
});

// POST /api/applications/:id/comments  { body }
// HR and the candidate's own panellists both post here — one shared thread, so a
// note left by either side is on the record everyone working the candidate reads.
router.post('/:id/comments', async (req, res) => {
  const app = await readableApplication(req, req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const body = String((req.body || {}).body || '').trim();
  if (!body) return res.status(400).json({ error: 'Write something before posting' });
  if (body.length > 2000) return res.status(400).json({ error: 'A comment is at most 2000 characters' });
  const c = await ApplicationComment.create({
    application_id: app._id,
    author_user_id: req.user._id,
    author_name: req.user.name,
    // The hat they are wearing: a dual-role user posting from the HR panel signs as HR.
    author_role: req.user.hasRole('hr_admin') ? 'hr_admin' : 'interviewer',
    author_designation: req.user.designation || '',
    body,
  });
  res.status(201).json({ comment: commentJSON(c) });
});

// DELETE /api/applications/:id/comments/:commentId — author removes their own;
// HR can remove any, since HR owns the record the thread hangs off.
router.delete('/:id/comments/:commentId', async (req, res) => {
  const app = await readableApplication(req, req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!mongoose.isValidObjectId(req.params.commentId)) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  const c = await ApplicationComment.findOne({ _id: req.params.commentId, application_id: app._id });
  if (!c) return res.status(404).json({ error: 'Comment not found' });
  const mine = String(c.author_user_id) === String(req.user._id);
  if (!mine && !req.user.hasRole('hr_admin')) {
    return res.status(403).json({ error: 'You can only delete your own comment' });
  }
  await c.deleteOne();
  res.json({ ok: true });
});

/* ===== HR: push an application to a different role ===== */

// POST /api/applications/:id/move  { job_code, designation, note? }
// The candidate applied to the wrong role, or is a better fit elsewhere. The
// application ID is KEPT and the old role is recorded in
// move_history, so the register still shows where the candidate came from.
router.post('/:id/move', requireRole('hr_admin'), async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const job_code = String((req.body || {}).job_code || '').trim();
  const designation = String((req.body || {}).designation || '').trim();
  const note = String((req.body || {}).note || '').trim();
  if (!job_code || !designation) {
    return res.status(400).json({ error: 'Target job_code and designation are required' });
  }
  if (job_code === app.job_code && designation === app.designation) {
    return res.status(400).json({ error: 'The application is already against that role' });
  }
  if (note.length > 300) return res.status(400).json({ error: 'Move note must be 300 characters or fewer' });

  /* An interview already scored was scored against the OLD scorecard — a different
     grade runs a different number of rounds, and a different department a different
     competency profile. Rather than carry forward a score that no longer means what
     it says, the move is refused outright. */
  const scored = await PanelScore.countDocuments({ application_id: app._id });
  if (scored > 0) {
    return res.status(400).json({
      error: `Cannot move: ${scored} interview round(s) have already been scored against ${app.designation}, `
        + 'on the scorecard for that role. Reject this application and ask the candidate to apply to the other role.',
    });
  }
  if (app.stage === 'Selected') {
    return res.status(400).json({
      error: 'Cannot move a Selected candidate — move them out of Selected first, which releases their seat.',
    });
  }

  // The target must be a real role with a seat open to recruit into.
  const target = await Position.findOne({
    job_code, designation, status: { $in: RECRUITABLE_STATUSES },
  }).sort({ pcn: 1 });
  if (!target) {
    return res.status(400).json({
      error: `No seat under ${designation} (${job_code}) is Vacant or Under Recruitment, so there is nothing to move the application to.`,
    });
  }

  const prevJobCode = app.job_code;
  const prevDesignation = app.designation;
  app.move_history.push({
    from_job_code: app.job_code,
    from_designation: app.designation,
    from_stage: app.stage,
    from_rejection_reason: app.rejection_reason || '',
    moved_by: req.user._id,
    moved_by_name: req.user.name,
    note,
  });

  // Take the whole role snapshot from the target seat — leaving a stale grade or
  // competency_profile behind would hand the candidate the wrong scorecard.
  app.job_code = target.job_code;
  app.designation = target.designation;
  app.department = target.department;
  app.grade = target.grade;
  app.job_family = target.job_family || '';
  app.competency_profile = target.competency_profile ?? null;
  app.unit = target.unit;
  app.unit_code = target.unit_code;

  /* The move is a fresh start against the new role: any panel appointed for the
     old one is dropped (none of it is scored — that was refused above), and the
     application returns to Applied with its interview date and rejection cleared. */
  await PanelAssignment.deleteMany({ application_id: app._id });
  app.stage = 'Applied';
  app.interview_date = '';
  app.rejection_reason = '';
  await app.save();

  await recordEvent(app._id, 'move', `Moved to ${target.designation}`, {
    actor: req.user,
    from: `${prevDesignation} (${prevJobCode})`,
    to: `${target.designation} (${target.job_code})`,
    detail: note,
  });
  res.json({ application: await withDerived(app), moved_to: { job_code, designation, grade: target.grade } });
});

/* ===== Shared read: timeline (HR + assigned interviewers) ===== */

/* The application's history in one list. Three sources are merged, so nothing has
   to be trusted to stay in step with anything else:
     · the application itself supplies the one event that always exists (applied),
     · PanelScore supplies each round as it was actually submitted,
     · ApplicationEvent supplies the actions HR took, which nothing else records.
   Applications created before events were logged still show a real timeline from
   the first two. */
router.get('/:id/timeline', async (req, res) => {
  const app = await readableApplication(req, req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const docNames = (app.documents || []).map((d) => d.filename).filter(Boolean);
  const [events, scores, assignments, docs] = await Promise.all([
    ApplicationEvent.find({ application_id: app._id }).sort('at'),
    PanelScore.find({ application_id: app._id }, 'round total_score panelist_name red_flags submitted_at').sort('submitted_at'),
    PanelAssignment.find({ application_id: app._id }).populate('assigned_by', 'name'),
    docNames.length
      ? CandidateDocument.find({ filename: { $in: docNames } }, 'filename original_name created_at')
      : [],
  ]);
  const rounds = await roundsForGrade(app.grade);

  /* An application worked before the action log existed has no stored events, so
     its history is RECONSTRUCTED from the records that were already being kept:
     panel assignments, the move history, the offer-sent stamp and the document
     rows all carry their own timestamps.

     A derived entry is dropped when a stored event of the same kind sits within a
     few seconds of it — the two describe the same action, and an application that
     straddles the upgrade must not show it twice. */
  const DEDUPE_MS = 10000;
  const covered = (type, at) => events.some(
    (e) => e.type === type && Math.abs(new Date(e.at) - new Date(at)) < DEDUPE_MS
  );

  const derived = [];

  // Panel appointments — assigned_at/assigned_by have always been recorded.
  const byMoment = new Map();
  for (const a of assignments) {
    if (!a.assigned_at) continue;
    // Rounds laid down together share one appointment; group them into one entry.
    const bucket = Math.floor(new Date(a.assigned_at).getTime() / DEDUPE_MS);
    if (!byMoment.has(bucket)) byMoment.set(bucket, []);
    byMoment.get(bucket).push(a);
  }
  for (const group of byMoment.values()) {
    const at = group[0].assigned_at;
    if (covered('panel', at)) continue;
    const auto = group.every((a) => a.auto_assigned);
    derived.push({
      type: 'panel',
      summary: `${auto ? 'Standing panel appointed' : 'Interview panel appointed by hand'} — ${group.length} round(s)`,
      detail: `Round ${group.map((a) => a.round).sort((x, y) => x - y).join(', ')}`,
      actor_name: group[0].assigned_by?.name || '',
      actor_role: group[0].assigned_by ? 'hr_admin' : '',
      at,
      derived: true,
    });
  }

  // Role moves — move_history has always carried who and when.
  for (const m of app.move_history || []) {
    if (!m.moved_at || covered('move', m.moved_at)) continue;
    derived.push({
      type: 'move',
      summary: `Moved to ${app.designation}`,
      detail: m.note || '',
      from: `${m.from_designation} (${m.from_job_code})`,
      to: `${app.designation} (${app.job_code})`,
      actor_name: m.moved_by_name || '',
      actor_role: m.moved_by_name ? 'hr_admin' : '',
      at: m.moved_at,
      derived: true,
    });
  }

  // Offer letter emailed — the stamp was kept, though not who sent it.
  if (app.offer_sent_at && !covered('offer', app.offer_sent_at)) {
    derived.push({
      type: 'offer',
      summary: 'Offer letter emailed',
      detail: app.offer_sent_to || '',
      actor_name: '',
      at: app.offer_sent_at,
      derived: true,
    });
  }

  /* Documents — the bytes carry their own upload time. The CV that came WITH the
     application is written moments before the application row itself, so it would
     otherwise appear above "Application received"; those are part of applying, not
     a later attachment, and belong on the applied entry instead. */
  /* The apply route writes the document rows BEFORE the application row, so a
     document submitted with the application always stamps at or before
     applied_on. That makes a strict comparison the exact discriminator — no
     time buffer, which would swallow a genuine attachment made minutes later. */
  const appliedAt = new Date(app.applied_on).getTime();
  const attachedLater = docs.filter((d) => d.created_at && new Date(d.created_at).getTime() > appliedAt);
  for (const d of attachedLater) {
    if (covered('document', d.created_at)) continue;
    derived.push({
      type: 'document',
      summary: 'Document attached',
      detail: d.original_name || d.filename,
      actor_name: '',
      at: d.created_at,
      derived: true,
    });
  }

  /* The approval was signed off on a date HR typed in, not at a moment we
     recorded — so it is placed on that date and marked as a recorded date rather
     than a captured action. */
  const ap = app.approval || {};
  if (ap.approval_date && !events.some((e) => e.type === 'approval')) {
    derived.push({
      type: 'approval',
      summary: 'Approval recorded',
      detail: [
        ap.recommended_by ? `Recommended by ${ap.recommended_by}` : null,
        ap.salary_approved_by ? `Salary approved by ${ap.salary_approved_by}` : null,
      ].filter(Boolean).join(' · '),
      actor_name: ap.salary_approved_by || '',
      at: new Date(`${ap.approval_date}T00:00:00`),
      derived: true,
    });
  }

  const items = [
    {
      type: 'applied',
      summary: 'Application received',
      detail: [
        app.source ? `via ${app.source}` : null,
        `for ${app.designation}`,
        docs.length - attachedLater.length > 0
          ? `${docs.length - attachedLater.length} document(s) submitted`
          : null,
      ].filter(Boolean).join(' · '),
      actor_name: app.candidate_name,
      at: app.applied_on,
    },
    ...events.map((e) => ({
      type: e.type,
      summary: e.summary,
      detail: e.detail,
      from: e.from,
      to: e.to,
      actor_name: e.actor_name,
      actor_role: e.actor_role,
      at: e.at,
    })),
    ...scores.map((sc) => ({
      type: 'score',
      summary: `Round ${sc.round} scored — ${sc.total_score}/100`,
      detail: [
        sc.panelist_name,
        (sc.red_flags || []).length ? `red flag: ${sc.red_flags.join(', ')}` : null,
      ].filter(Boolean).join(' · '),
      actor_name: sc.panelist_name,
      actor_role: 'interviewer',
      at: sc.submitted_at,
    })),
    ...derived,
  ].filter((i) => i.at && !Number.isNaN(new Date(i.at).getTime()));

  items.sort((a, b) => new Date(a.at) - new Date(b.at));

  res.json({
    timeline: items,
    /* Stage changes were never stored before the action log, so an application
       worked before then shows its milestones but not every move between them.
       The client says so rather than implying the history is complete. */
    reconstructed: derived.length > 0 || !events.some((e) => e.type === 'stage'),
    current: {
      stage: app.stage,
      rounds,
      rounds_scored: scores.length,
      panel_appointed: assignments.length,
      awaiting: app.stage === 'Interview Scheduled' && scores.length < rounds
        ? `Round ${scores.length + 1} of ${rounds}`
        : null,
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
