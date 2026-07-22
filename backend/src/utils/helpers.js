import Counter from '../models/Counter.js';
import Grade from '../models/Grade.js';
import Competency from '../models/Competency.js';

/* ===== Shared 5-level behavioural scale (Exceptional 100% … Not Suitable 20%) ===== */
export const LEVELS = [
  { label: 'Exceptional', pct: 1.0 },
  { label: 'Strong', pct: 0.8 },
  { label: 'Acceptable', pct: 0.6 },
  { label: 'Below Expectations', pct: 0.4 },
  { label: 'Not Suitable', pct: 0.2 },
];

export const RECRUITABLE_STATUSES = ['Vacant', 'Under Recruitment'];
export const recruitable = (p) => RECRUITABLE_STATUSES.includes(p.status);

// Job code = PCN minus the trailing seat serial: CPA-FO-C1-001 → CPA-FO-C1
export const jobCodeOf = (pcn) => String(pcn).replace(/-\d{3,}$/, '');

export const wordCount = (t) => {
  const s = String(t || '').trim();
  return s ? s.split(/\s+/).length : 0;
};

// Days idle — only counts while a seat sits in status 'Vacant' (not yet under recruitment)
export function daysVacant(p) {
  if (p.status !== 'Vacant' || !p.vacant_since) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = new Date(p.vacant_since);
  since.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - since) / 86400000));
}

export function slaBreached(p) {
  const dv = daysVacant(p);
  return dv != null && p.replacement_sla_days != null && dv > p.replacement_sla_days;
}

export function recommendation(total) {
  if (total >= 85) return 'Strongly Recommend';
  if (total >= 70) return 'Recommend';
  if (total >= 55) return 'Hold';
  return 'Do Not Recommend';
}

// How many interview ROUNDS this grade runs. Grade.panel_size carries the number
// (3 for A-grades and above, 2 for B/C) — the same figure the workbook implies by
// filling PANEL 1/2/3 on senior rows and only PANEL 1/2 on junior ones.
export async function roundsForGrade(gradeCode) {
  const g = await Grade.findOne({ code: gradeCode });
  return g ? g.panel_size : 2;
}

/* ===== Fixed panel lookup (Interview_Panel.xlsx) =====
   Most specific match wins: an exact department rule beats the unit's '*' rule.
   Returns null when nothing matches, which leaves the panel for HR to set by hand. */
export async function resolvePanelRule(unitCode, gradeCode, department) {
  const PanelRule = (await import('../models/PanelRule.js')).default;
  const candidates = await PanelRule.find({
    unit_code: unitCode, grade: gradeCode, department: { $in: [department, '*'] },
  });
  if (!candidates.length) return null;
  return candidates.find((c) => c.department === department) || candidates.find((c) => c.department === '*');
}

// Writes the fixed panel onto an application. Rounds already scored are left alone
// so a re-run can never rewrite history; HR's manual picks survive unless `replace`.
export async function applyPanelRule(app, { assignedBy = null, replace = false } = {}) {
  const PanelAssignment = (await import('../models/PanelAssignment.js')).default;
  const rule = await resolvePanelRule(app.unit_code, app.grade, app.department);
  if (!rule) return { applied: 0, rule: null };

  const existing = await PanelAssignment.find({ application_id: app._id });
  const scoredRounds = new Set(existing.filter((e) => e.status === 'Scored').map((e) => e.round));
  const heldRounds = new Set(existing.map((e) => e.round));

  let applied = 0;
  for (const slot of rule.rounds) {
    if (scoredRounds.has(slot.round)) continue;
    if (!replace && heldRounds.has(slot.round)) continue;
    await PanelAssignment.findOneAndUpdate(
      { application_id: app._id, round: slot.round },
      {
        interviewer_user_id: slot.interviewer_user_id,
        panel_role: `Panel ${slot.round}`,
        assigned_by: assignedBy,
        auto_assigned: true,
        assigned_at: new Date(),
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    applied += 1;
  }
  return { applied, rule };
}

// PCN generation is server-side and atomic so concurrent HR users can't collide.
// Format: UNIT-DEPT-GRADE-SERIAL, e.g. CPA-FO-C1-001
export async function nextPCN(unitAbbr, deptAbbr, grade) {
  const key = `${unitAbbr}-${deptAbbr}-${grade}`;
  const c = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${key}-${String(c.seq).padStart(3, '0')}`;
}

export const DEPT_ABBR = {
  'Front Office': 'FO', 'F&B Service': 'FB', 'Kitchen': 'KIT', 'Housekeeping': 'HK',
  'Engineering': 'ENG', 'Security': 'SEC', 'Admin': 'ADM', 'Stores': 'STR',
  'Kitchen Stewarding': 'KST', 'Leadership': 'LDR', 'Operations': 'OPS',
};
export const deptAbbrOf = (dept) =>
  DEPT_ABBR[dept] || String(dept).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'GEN';

// Resolve the scoring form for a role: core Attitude block (60%) + the role's
// skills/knowledge profile, falling back to the generic placeholder profile.
export async function resolveCompetencies(profile) {
  const core = await Competency.find({ profile: 'core' }).sort('order');
  let rest = [];
  if (profile) rest = await Competency.find({ profile }).sort('order');
  if (!rest.length) rest = await Competency.find({ profile: 'generic' }).sort('order');
  return [...core, ...rest];
}

// The final recommendation is the average across all rounds, so an early round
// carries the same weight as the last one.
export function scoreSummary(scores, rounds) {
  if (!scores.length) {
    return {
      count: 0, needed: rounds, average: null, spread: 0, diverged: false,
      any_red_flags: false, recommendation: null, rounds_completed: [], next_round: 1,
    };
  }
  const totals = scores.map((s) => s.total_score);
  const average = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  const spread = totals.length > 1 ? Math.max(...totals) - Math.min(...totals) : 0;
  const done = [...new Set(scores.map((s) => s.round || 1))].sort((a, b) => a - b);
  return {
    count: scores.length,
    needed: rounds,
    average,
    spread,
    diverged: spread > 15, // >15-point divergence between rounds → HR should look, not average blindly
    any_red_flags: scores.some((s) => (s.red_flags || []).length > 0),
    recommendation: recommendation(average),
    rounds_completed: done,
    next_round: done.length >= rounds ? null : (done.length ? Math.max(...done) + 1 : 1),
  };
}

export function makeReferenceId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `CPH-${s}`;
}
