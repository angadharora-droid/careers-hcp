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

export async function panelSizeForGrade(gradeCode) {
  const g = await Grade.findOne({ code: gradeCode });
  return g ? g.panel_size : 2;
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

export function scoreSummary(scores, panelSize) {
  if (!scores.length) return { count: 0, needed: panelSize, average: null, spread: 0, diverged: false, any_red_flags: false, recommendation: null };
  const totals = scores.map((s) => s.total_score);
  const average = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  const spread = totals.length > 1 ? Math.max(...totals) - Math.min(...totals) : 0;
  return {
    count: scores.length,
    needed: panelSize,
    average,
    spread,
    diverged: spread > 15, // >15-point divergence → panel should discuss, not average
    any_red_flags: scores.some((s) => (s.red_flags || []).length > 0),
    recommendation: recommendation(average),
  };
}

export function makeReferenceId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `CPH-${s}`;
}
