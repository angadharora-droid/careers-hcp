import { Router } from 'express';
import Application from '../models/Application.js';
import Position from '../models/Position.js';
import PanelAssignment from '../models/PanelAssignment.js';
import PanelScore from '../models/PanelScore.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { RECRUITABLE_STATUSES, roundsForGrade, bandStanding } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth, requireRole('hr_admin'));

/* The Application Register is the auditable paper form behind the pipeline:
   one register per vacant post (job_code + designation), Section A tracking every
   applicant, Section B recording who recommended and approved the selection, and
   Section C carrying the sign-off.

   Everything here is COMPILED from positions, applications, panel assignments and
   panel scores — the register holds no pipeline state of its own, so it can never
   drift from what Applications shows. The only stored register fields are HR's own
   annotations (remarks, employer, notice period, relevant experience) and the
   Section B approval authorities. */

/* ===== Section A derivations =====
   Screening / interview status / final decision are three different questions the
   register asks, and the pipeline's single `stage` answers none of them alone —
   they are read off stage TOGETHER with the panel record. */

// Did this application get past the paper sift?
function screeningOf(app, assignments) {
  if (assignments.length > 0 || app.interview_date) return 'Shortlisted';
  if (app.stage === 'Rejected') return 'Not shortlisted';
  if (app.stage === 'On Hold') return 'On hold';
  return 'Pending';
}

// How far through the interview rounds did they get?
function interviewStatusOf(app, assignments, scores, rounds) {
  if (!assignments.length) return 'N.A.';
  const done = scores.length;
  if (done === 0) {
    // Panel appointed but nothing scored. If the candidate has already been
    // rejected or parked, the rounds did not happen rather than being pending.
    if (app.stage === 'Rejected' || app.stage === 'On Hold') return 'Did not attend';
    const next = Math.min(...assignments.map((a) => a.round));
    return `Round ${next} scheduled`;
  }
  if (done >= rounds) return rounds === 2 ? 'Both rounds cleared' : 'All rounds cleared';
  const last = Math.max(...scores.map((s) => s.round || 1));
  return `Round ${last} cleared`;
}

// Where the application finally landed.
function finalDecisionOf(app, scores, rounds) {
  if (app.stage === 'Selected') return 'Selected';
  if (app.stage === 'Rejected') return 'Rejected';
  if (app.stage === 'On Hold') return 'On hold';
  // Panel is finished but HR has not called it yet — the sample format's
  // "Final pending" row.
  if (scores.length >= rounds && rounds > 0) return 'Final pending';
  return 'Pending';
}

/* Applications that arrive once the post is no longer taking candidates must be
   marked, not silently left looking live.
     Talent Pool — arrived AFTER the post closed; keep on file for a future vacancy.
     Post Closed — arrived before closure but still undecided when the last seat went. */
function registerFlagOf(app, dateClosed) {
  if (!dateClosed) return '';
  if (new Date(app.applied_on) > new Date(dateClosed)) return 'Talent Pool';
  if (['Applied', 'Interview Scheduled', 'On Hold'].includes(app.stage)) return 'Post Closed';
  return '';
}

// dd-mm-yy, as the sample register writes dates in Section A.
function shortDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getDate())}-${p(x.getMonth() + 1)}-${String(x.getFullYear()).slice(2)}`;
}

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/* Opening and closing dates of the recruitment drive, read off the seats.
   Opened  — the earliest a seat under this post went vacant.
   Closed  — null while any seat is still recruitable; otherwise the moment the
             last seat was taken, i.e. the newest selection under this post. */
function periodOf(seats, selectedApps) {
  const openStamps = seats
    .map((p) => p.vacant_since || p.created_at)
    .filter(Boolean)
    .map((d) => new Date(d).getTime());
  const date_opened = openStamps.length ? new Date(Math.min(...openStamps)) : null;

  const stillOpen = seats.some((p) => RECRUITABLE_STATUSES.includes(p.status));
  let date_closed = null;
  if (!stillOpen && selectedApps.length) {
    date_closed = new Date(Math.max(...selectedApps.map((a) => new Date(a.updated_at || a.applied_on).getTime())));
  }
  return { date_opened, date_closed };
}

/* ===== GET /api/register/posts =====
   The picker: every post that has a sanctioned seat or an application behind it.
   A register is kept "separately for each vacant post/designation", so the key is
   job_code + designation — two designations may legitimately share a job code. */
router.get('/posts', async (_req, res) => {
  const [positions, apps] = await Promise.all([
    Position.find({ status: { $ne: 'Eliminated' } }).sort('pcn'),
    Application.find({}, 'job_code designation department grade stage applied_on updated_at'),
  ]);

  const posts = new Map();
  const keyOf = (jobCode, designation) => `${jobCode}||${designation}`;
  const ensure = (src) => {
    const key = keyOf(src.job_code, src.designation);
    if (!posts.has(key)) {
      posts.set(key, {
        key,
        job_code: src.job_code,
        designation: src.designation,
        department: src.department || '',
        grade: src.grade || '',
        unit: src.unit || 'Centre Point Amravati',
        seats: [],
        apps: [],
      });
    }
    return posts.get(key);
  };

  for (const p of positions) ensure(p).seats.push(p);
  for (const a of apps) ensure(a).apps.push(a);

  const rows = [...posts.values()].map((g) => {
    const selected = g.apps.filter((a) => a.stage === 'Selected');
    const { date_opened, date_closed } = periodOf(g.seats, selected);
    const open = g.seats.filter((p) => RECRUITABLE_STATUSES.includes(p.status)).length;
    return {
      key: g.key,
      job_code: g.job_code,
      designation: g.designation,
      department: g.department || g.seats[0]?.department || '',
      grade: g.grade || g.seats[0]?.grade || '',
      unit: g.seats[0]?.unit || 'Centre Point Amravati',
      seats_total: g.seats.length,
      open_vacancies: open,
      // Seats this drive is accountable for: those still open plus those it filled.
      vacancies: open + selected.length,
      applications: g.apps.length,
      selected: selected.length,
      pending: g.apps.filter((a) => ['Applied', 'Interview Scheduled', 'On Hold'].includes(a.stage)).length,
      is_closed: open === 0 && g.seats.length > 0,
      date_opened: iso(date_opened),
      date_closed: iso(date_closed),
    };
  });

  rows.sort((a, b) =>
    (b.applications - a.applications)
    || String(a.department).localeCompare(String(b.department))
    || String(a.designation).localeCompare(String(b.designation)));

  res.json({ posts: rows });
});

/* ===== GET /api/register?job_code=&designation= =====
   The register itself: header block, Section A rows, Section B selection records,
   Section C sign-off. */
router.get('/', async (req, res) => {
  const job_code = String(req.query.job_code || '').trim();
  const designation = String(req.query.designation || '').trim();
  if (!job_code) return res.status(400).json({ error: 'job_code is required' });

  const posFilter = { job_code, status: { $ne: 'Eliminated' } };
  const appFilter = { job_code };
  if (designation) { posFilter.designation = designation; appFilter.designation = designation; }

  const [seats, apps] = await Promise.all([
    Position.find(posFilter).sort('pcn'),
    Application.find(appFilter).sort('applied_on'),
  ]);
  if (!seats.length && !apps.length) {
    return res.status(404).json({ error: 'No register found for this post' });
  }

  const appIds = apps.map((a) => a._id);
  const [assignments, scores] = await Promise.all([
    PanelAssignment.find({ application_id: { $in: appIds } })
      .populate('interviewer_user_id', 'name designation department'),
    PanelScore.find({ application_id: { $in: appIds } }, 'application_id round total_score red_flags panelist_name submitted_at'),
  ]);
  const byApp = (list) => {
    const m = new Map();
    for (const x of list) {
      const k = String(x.application_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  const assignBy = byApp(assignments);
  const scoreBy = byApp(scores);

  /* The post's sanctioned band, taken at its widest across the seats under it.
     Section A judges what candidates currently earn and what they expect against
     this, which is the cheapest screening signal the register has. */
  const lows = seats.map((p) => p.salary_min).filter((n) => n > 0);
  const highs = seats.map((p) => p.salary_max).filter((n) => n > 0);
  const bandMin = lows.length ? Math.min(...lows) : 0;
  const bandMax = highs.length ? Math.max(...highs) : 0;

  const selectedApps = apps.filter((a) => a.stage === 'Selected');
  const { date_opened, date_closed } = periodOf(seats, selectedApps);
  const open = seats.filter((p) => RECRUITABLE_STATUSES.includes(p.status)).length;
  const sample = seats[0] || apps[0];

  // Rounds vary by grade (2 or 3); resolve once per grade seen, not per row.
  const grades = [...new Set(apps.map((a) => a.grade).filter(Boolean))];
  const roundsByGrade = new Map(
    await Promise.all(grades.map(async (g) => [g, await roundsForGrade(g)]))
  );
  const defaultRounds = await roundsForGrade(sample?.grade);

  const rows = apps.map((app, i) => {
    const asg = (assignBy.get(String(app._id)) || []).sort((a, b) => a.round - b.round);
    const scs = (scoreBy.get(String(app._id)) || []).sort((a, b) => a.round - b.round);
    const rounds = roundsByGrade.get(app.grade) ?? defaultRounds;
    return {
      sr: i + 1,
      id: app._id,
      application_id: app.reference_id,
      date: shortDate(app.applied_on),
      applied_on: app.applied_on,
      candidate_name: app.candidate_name,
      mobile: app.mobile,
      email: app.email,
      source: app.source || '',
      qualification: app.qualification || '',
      total_experience_years: app.total_experience_years ?? null,
      relevant_hotel_experience_years: app.relevant_hotel_experience_years ?? null,
      current_employer: app.current_employer || '',
      current_designation: app.current_designation || '',
      current_salary: app.current_salary ?? null,
      expected_salary: app.expected_salary ?? null,
      // Where each sits against the post's band — null when no band is on file.
      current_salary_standing: bandStanding(app.current_salary, bandMin, bandMax),
      expected_salary_standing: bandStanding(app.expected_salary, bandMin, bandMax),
      notice_period: app.notice_period || '',
      screening: screeningOf(app, asg),
      interview_status: interviewStatusOf(app, asg, scs, rounds),
      final_decision: finalDecisionOf(app, scs, rounds),
      remarks: app.remarks || '',
      // Carried alongside the register vocabulary so the row can link back to the
      // pipeline without a second fetch.
      stage: app.stage,
      rejection_reason: app.rejection_reason || '',
      interview_date: app.interview_date || '',
      pcn: app.pcn || '',
      register_flag: registerFlagOf(app, date_closed),
      rounds,
      rounds_scored: scs.length,
      any_red_flags: scs.some((s) => (s.red_flags || []).length > 0),
      panel_average: scs.length ? Math.round(scs.reduce((n, s) => n + s.total_score, 0) / scs.length) : null,
      interviewers: asg.map((a) => a.interviewer_user_id?.name).filter(Boolean),
      documents: app.documents?.length || 0,
    };
  });

  // Section B — one record per selected candidate (a 2-vacancy post selects two).
  const selection = selectedApps.map((app) => {
    const asg = (assignBy.get(String(app._id)) || []).sort((a, b) => a.round - b.round);
    const ap = app.approval || {};
    const seat = seats.find((p) => String(p._id) === String(app.position_id));
    return {
      id: app._id,
      candidate_selected: app.candidate_name,
      application_id: app.reference_id,
      recommended_designation: [app.designation, app.grade].filter(Boolean).join(' - '),
      recommended_salary: app.offered_salary ?? null,
      // Control on the offer: where it sits against the seat's sanctioned band.
      salary_band: seat ? { min: seat.salary_min, max: seat.salary_max } : null,
      band_standing: seat ? bandStanding(app.offered_salary, seat.salary_min, seat.salary_max) : null,
      interviewed_by: asg
        .map((a) => a.interviewer_user_id?.designation || a.interviewer_user_id?.name)
        .filter(Boolean),
      interviewer_names: asg.map((a) => a.interviewer_user_id?.name).filter(Boolean),
      recommended_by: ap.recommended_by || '',
      salary_approved_by: ap.salary_approved_by || '',
      approval_date: ap.approval_date || '',
      offer_issued_date: ap.offer_issued_date || '',
      expected_joining_date: app.date_of_joining || '',
      employee_code: ap.employee_code || '',
      closed_by: ap.closed_by || '',
      // Control-point state the UI turns into gates.
      pcn: app.pcn || '',
      seat_status: seat?.status || '',
      offer_sent_at: app.offer_sent_at,
      offer_sent_to: app.offer_sent_to || '',
      approval_complete: Boolean(ap.approval_date && ap.salary_approved_by && app.offered_salary != null),
    };
  });

  res.json({
    header: {
      unit: sample?.unit || 'Centre Point Amravati',
      designation: designation || sample?.designation || '',
      department: sample?.department || '',
      job_code,
      grade: sample?.grade || '',
      seats_total: seats.length,
      open_vacancies: open,
      vacancies: open + selectedApps.length,
      salary_band: { min: bandMin, max: bandMax },
      register_owner: 'People & Culture',
      date_opened: iso(date_opened),
      date_closed: iso(date_closed),
      is_closed: open === 0 && seats.length > 0,
    },
    rows,
    selection,
  });
});

export default router;
