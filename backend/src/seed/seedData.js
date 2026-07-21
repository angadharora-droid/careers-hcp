/* Seed content extracted from the two original artifacts:
   - Artifact A (cph_position_control_suite.html): ROSTER, GRADES, PCN scheme
   - Artifact B (cph_interviewer_platform.html): richer per-competency anchor text
   Artifact A is the source of truth for designations/grades/departments/families;
   Artifact B's anchor wording is used where it is fuller. */

export const GRADES = [
  { code: 'BOD', meaning: 'Board', present_at_cpa: false, panel_size: 3, order: 1 },
  { code: 'H1', meaning: 'Enterprise Leadership', present_at_cpa: false, panel_size: 3, order: 2 },
  { code: 'H2', meaning: 'Corporate Functional Leadership', present_at_cpa: false, panel_size: 3, order: 3 },
  { code: 'H3', meaning: 'Corporate Professionals / Business Partners', present_at_cpa: false, panel_size: 3, order: 4 },
  { code: 'A1', meaning: 'Business Unit Head', present_at_cpa: true, panel_size: 3, order: 5 },
  { code: 'A2', meaning: 'Executive Committee', present_at_cpa: false, panel_size: 3, order: 6 },
  { code: 'A3', meaning: 'Department Head', present_at_cpa: true, panel_size: 3, order: 7 },
  { code: 'A4', meaning: 'Assistant Manager', present_at_cpa: false, panel_size: 2, order: 8 },
  { code: 'B1', meaning: 'Executive / Officer / Specialist', present_at_cpa: true, panel_size: 2, order: 9 },
  { code: 'B2', meaning: 'Supervisor / Team Leader', present_at_cpa: true, panel_size: 2, order: 10 },
  { code: 'C1', meaning: 'Associate', present_at_cpa: true, panel_size: 2, order: 11 },
  { code: 'C2', meaning: 'Junior Associate', present_at_cpa: true, panel_size: 2, order: 12 },
  { code: 'T', meaning: 'Trainee / Apprentice', present_at_cpa: false, panel_size: 2, order: 13 },
];

// CPA sanctioned strength — 26 designations, expands to 67 individual PCN seats.
// fo: competency profile key ('fo_assoc' | 'fo_exec') for roles with real content.
export const ROSTER = [
  { desig: 'General Manager', fam: 'Corporate Services', grade: 'A1', dept: 'Leadership', reports: 'Group / Ownership', count: 1, min: 150000, max: 250000, rev: true, guest: true, crit: true },
  { desig: 'Operations Manager', fam: 'Corporate Services', grade: 'A3', dept: 'Operations', reports: 'General Manager', count: 1, min: 30000, max: 65000, rev: true, guest: true, crit: true },
  { desig: 'Admin Head', fam: 'Administration', grade: 'A3', dept: 'Admin', reports: 'General Manager', count: 1, min: 30000, max: 65000, rev: false, guest: false, crit: true },
  { desig: 'Executive Chef', fam: 'Kitchen', grade: 'A3', dept: 'Kitchen', reports: 'General Manager', count: 1, min: 30000, max: 65000, rev: true, guest: false, crit: true },
  { desig: 'Front Office Executive', fam: 'Front Office', grade: 'B1', dept: 'Front Office', reports: 'Operations Manager', count: 1, min: 20000, max: 27000, rev: true, guest: true, crit: true, fo: 'fo_exec' },
  { desig: 'Admin Executive', fam: 'Administration', grade: 'B1', dept: 'Admin', reports: 'Admin Head', count: 2, min: 20000, max: 27000, rev: false, guest: false, crit: false },
  { desig: 'Security Executive', fam: 'Security', grade: 'B1', dept: 'Security', reports: 'Operations Manager', count: 1, min: 20000, max: 27000, rev: false, guest: false, crit: true },
  { desig: 'F&B Executive', fam: 'F&B Service', grade: 'B1', dept: 'F&B Service', reports: 'Operations Manager', count: 2, min: 20000, max: 27000, rev: true, guest: true, crit: true },
  { desig: 'Engineering Executive', fam: 'Engineering', grade: 'B1', dept: 'Engineering', reports: 'Operations Manager', count: 1, min: 20000, max: 27000, rev: false, guest: false, crit: true },
  { desig: 'Housekeeping Executive', fam: 'Housekeeping', grade: 'B1', dept: 'Housekeeping', reports: 'Operations Manager', count: 1, min: 20000, max: 27000, rev: false, guest: true, crit: true },
  { desig: 'Chef de Partie', fam: 'Kitchen', grade: 'B1', dept: 'Kitchen', reports: 'Executive Chef', count: 1, min: 22000, max: 32000, rev: true, guest: false, crit: false },
  { desig: 'Demi Chef de Partie', fam: 'Kitchen', grade: 'B2', dept: 'Kitchen', reports: 'Chef de Partie', count: 1, min: 18000, max: 25000, rev: true, guest: false, crit: false },
  { desig: 'Team Leader — F&B', fam: 'F&B Service', grade: 'B2', dept: 'F&B Service', reports: 'F&B Executive', count: 2, min: 15000, max: 20000, rev: true, guest: true, crit: false },
  { desig: 'Housekeeping Supervisor', fam: 'Housekeeping', grade: 'B2', dept: 'Housekeeping', reports: 'Housekeeping Executive', count: 2, min: 15000, max: 20000, rev: false, guest: true, crit: false },
  { desig: 'Kitchen Stewarding Supervisor', fam: 'Kitchen', grade: 'B2', dept: 'Kitchen Stewarding', reports: 'Executive Chef', count: 1, min: 15000, max: 20000, rev: false, guest: false, crit: false },
  { desig: 'Engineering Associate', fam: 'Engineering', grade: 'C1', dept: 'Engineering', reports: 'Engineering Executive', count: 2, min: 13000, max: 18000, rev: false, guest: false, crit: false },
  { desig: 'Guest Service Associate — F&B', fam: 'F&B Service', grade: 'C1', dept: 'F&B Service', reports: 'Team Leader — F&B', count: 12, min: 13000, max: 18000, rev: true, guest: true, crit: false },
  { desig: 'Senior Commis', fam: 'Kitchen', grade: 'C1', dept: 'Kitchen', reports: 'Chef de Partie', count: 5, min: 15000, max: 22000, rev: true, guest: false, crit: false },
  { desig: 'Junior Commis', fam: 'Kitchen', grade: 'C2', dept: 'Kitchen', reports: 'Senior Commis', count: 5, min: 14000, max: 18000, rev: true, guest: false, crit: false },
  { desig: 'Guest Service Associate — Front Office', fam: 'Front Office', grade: 'C1', dept: 'Front Office', reports: 'Front Office Executive', count: 3, min: 13000, max: 18000, rev: true, guest: true, crit: false, fo: 'fo_assoc' },
  { desig: 'Guest Service Associate — Housekeeping', fam: 'Housekeeping', grade: 'C1', dept: 'Housekeeping', reports: 'Housekeeping Supervisor', count: 9, min: 13000, max: 18000, rev: false, guest: true, crit: false },
  { desig: 'Store Associate', fam: 'Purchase', grade: 'C1', dept: 'Stores', reports: 'Admin Head', count: 1, min: 13000, max: 18000, rev: false, guest: false, crit: false },
  { desig: 'Security Guard', fam: 'Security', grade: 'C1', dept: 'Security', reports: 'Security Executive', count: 3, min: 13000, max: 18000, rev: false, guest: true, crit: false },
  // abbr 'VAL': Valet shares dept+grade (FO-C1) with GSA-Front Office — a distinct
  // sub-code keeps job_code role-unique so the Career Panel can't merge the two roles.
  { desig: 'Guest Service Associate — Valet', fam: 'Front Office', grade: 'C1', dept: 'Front Office', abbr: 'VAL', reports: 'Front Office Executive', count: 2, min: 13000, max: 18000, rev: false, guest: true, crit: false },
  { desig: 'Bell Attendant', fam: 'Front Office', grade: 'C2', dept: 'Front Office', reports: 'Front Office Executive', count: 2, min: 12500, max: 14000, rev: false, guest: true, crit: false },
  { desig: 'Kitchen Steward', fam: 'Kitchen', grade: 'C2', dept: 'Kitchen Stewarding', reports: 'Kitchen Stewarding Supervisor', count: 4, min: 12500, max: 14000, rev: false, guest: false, crit: false },
];

// Default job descriptions so the Career Panel isn't empty on first run.
// Plain text with blank-line paragraphs; HR edits these in the Position modal.
const DEPT_BLURB = {
  'Front Office': 'welcoming guests, managing check-in and check-out, handling reservations and guest requests, and being the face of Centre Point hospitality',
  'F&B Service': 'serving guests in our restaurants and banquets, taking orders, presenting dishes and ensuring every meal is a warm Centre Point experience',
  'Kitchen': 'preparing food to Centre Point quality and hygiene standards, supporting the kitchen brigade and keeping every plate consistent',
  'Housekeeping': 'keeping guest rooms and public areas spotless, fresh and guest-ready, with an eye for the small details guests remember',
  'Engineering': 'maintaining the hotel’s equipment, utilities and guest-room fittings so everything simply works, safely and quietly',
  'Security': 'keeping guests, staff and property safe with vigilant, courteous and discreet security operations',
  'Admin': 'running the administrative backbone of the hotel — records, coordination, compliance and support to every department',
  'Stores': 'receiving, storing and issuing hotel supplies accurately so every department has what it needs when it needs it',
  'Kitchen Stewarding': 'keeping the kitchen’s equipment, crockery and work areas hygienically clean and organised behind the scenes',
  'Leadership': 'leading the hotel’s overall operations, standards, team and results',
  'Operations': 'coordinating day-to-day operations across departments so the guest experience is seamless',
};

export function makeJobDescription(r) {
  const blurb = DEPT_BLURB[r.dept] || 'supporting daily hotel operations';
  return (
    `About the role\n` +
    `As ${/^[AEIOU]/i.test(r.desig) ? 'an' : 'a'} ${r.desig} at Centre Point Amravati, you will be part of the ${r.dept} team, ${blurb}.\n\n` +
    `What you'll do\n` +
    `• Deliver warm, guest-first service in line with Centre Point values\n` +
    `• Work closely with your team and report to the ${r.reports}\n` +
    `• Uphold grooming, hygiene and professional standards at all times\n` +
    `• Learn continuously — we train for skill, we hire for attitude\n\n` +
    `Who we're looking for\n` +
    `A positive, guest-oriented person with clear communication and a genuine willingness to learn. ` +
    `Prior hospitality experience helps but attitude matters more than technical knowledge, which we can teach.`
  );
}

/* ===== Competency library (Artifact B anchor text) ===== */
const L = (a, b, c, d, e) => [a, b, c, d, e];

export const COMPETENCIES = [
  // core Attitude — 60%, every role
  {
    profile: 'core', key: 'guest', name: 'Guest Orientation', section: 'att', weight: 20, order: 1,
    anchors: L(
      'Naturally creates a warm first impression; gave a specific example of anticipating a guest need or going beyond role. Would represent CP unsupervised.',
      'Friendly, courteous, guest-focused; handles most interactions confidently with only minor coaching needed.',
      'Understands service matters and is polite, but lacks confidence or consistency; suitable with structured training.',
      'Basic responses, limited warmth/empathy/ownership; may struggle in demanding guest situations.',
      'No service mindset; appears indifferent to guests or inconsistent with CP standards.'
    ),
  },
  {
    profile: 'core', key: 'culture', name: 'Cultural Fit (Centre Point values)', section: 'att', weight: 15, order: 2,
    anchors: L(
      'Gave concrete examples showing flexibility AND focus; values align with CP (guest-first, ownership, respect). Adapts without losing standards.',
      "Clearly shares CP's service values; showed willingness to flex to guest/team needs with a real example.",
      'Values broadly compatible; stated the right intent but example was generic or hypothetical.',
      'Some value tension — rigid where flexibility is needed, or flexible where standards must hold.',
      'Values conflict with CP culture; dismissive of guest-first or team-first behaviour.'
    ),
  },
  {
    profile: 'core', key: 'comm', name: 'Communication', section: 'att', weight: 15, order: 3,
    anchors: L(
      'Speaks confidently, listens actively, explains clearly, professional throughout, strong eye contact.',
      'Clear and confident communication, only minor improvement needed.',
      'Communicates basic information but needs coaching in confidence, fluency or professional language.',
      'Frequently struggles to express thoughts; repeated clarification needed.',
      'Communication inadequate for a guest-facing hospitality role.'
    ),
  },
  {
    profile: 'core', key: 'team', name: 'Learning Attitude & Teamwork', section: 'att', weight: 10, order: 4,
    anchors: L(
      'Highly coachable and collaborative; actively seeks feedback; gave a real example of helping a teammate.',
      'Works well with others, willing to learn.',
      'Learns with supervision, contributes when guided.',
      'Shows resistance to feedback or teamwork.',
      'Negative attitude toward learning or collaboration.'
    ),
  },
];

// FO Skills (shared by Associate & Executive profiles — duplicated so each can be edited independently)
const FO_SKILLS = [
  {
    key: 'practical', name: 'Practical Assessment (mock check-in / scenario)', section: 'skill', weight: 12, order: 10,
    anchors: L(
      'Handled mock check-in and an early-check-in/room-not-ready scenario smoothly; upsold naturally; professional phone manner.',
      'Completed the mock tasks well with minor prompting.',
      'Managed basic scenario but hesitant on upsell or problem scenario.',
      'Struggled with the practical scenario; needed heavy guidance.',
      'Could not perform the core front-desk task.'
    ),
  },
  {
    key: 'problem', name: 'Problem Solving', section: 'skill', weight: 8, order: 11,
    anchors: L(
      "Stayed calm on the 'guest shouting' scenario; proposed a clear, guest-preserving resolution with ownership.",
      'Reasonable resolution with good composure.',
      'Basic resolution, some composure but limited ownership.',
      'Flustered; resolution weak or deflected blame.',
      'No workable approach; poor conflict handling.'
    ),
  },
  {
    key: 'groom', name: 'Grooming & Professional Presence', section: 'skill', weight: 5, order: 12,
    anchors: L(
      'Polished, hotel-ready; excellent posture, hygiene, etiquette.',
      'Well groomed and professional, minor improvements only.',
      'Meets minimum hospitality expectation, needs coaching.',
      'Grooming/body language below hospitality standard.',
      'Appearance/conduct inconsistent with CP image.'
    ),
  },
];

for (const profile of ['fo_assoc', 'fo_exec']) {
  for (const s of FO_SKILLS) COMPETENCIES.push({ ...s, profile });
}

COMPETENCIES.push(
  {
    profile: 'fo_assoc', key: 'foknow', name: 'Front Office Knowledge', section: 'know', weight: 10, order: 20,
    anchors: L(
      'Confidently explained check-in documents, difference between reservation/registration/check-in, and guest folio.',
      'Good grasp of core FO concepts, minor gaps.',
      'Basic understanding of the fundamentals.',
      'Limited; unsure on most FO basics.',
      'No relevant front-office knowledge.'
    ),
  },
  {
    profile: 'fo_assoc', key: 'hosaware', name: 'Hospitality Awareness', section: 'know', weight: 5, order: 21,
    anchors: L(
      'Strong sense of hospitality industry, brand awareness, guest-lifecycle understanding.',
      'Good general awareness.', 'Average awareness.', 'Weak awareness.', 'No awareness.'
    ),
  },
  {
    profile: 'fo_exec', key: 'foknow', name: 'Front Office Knowledge (Executive)', section: 'know', weight: 10, order: 20,
    anchors: L(
      'Explained overbooking management and shift-closing/cash handling clearly, in addition to core FO concepts.',
      'Good grasp incl. some supervisory concepts, minor gaps.',
      'Basic fundamentals but weak on supervisory topics.',
      'Limited; unsure on most executive-level FO topics.',
      'No relevant executive front-office knowledge.'
    ),
  },
  {
    profile: 'fo_exec', key: 'hosaware', name: 'Hospitality Awareness', section: 'know', weight: 5, order: 21,
    anchors: L(
      'Strong industry/brand awareness and guest-lifecycle understanding.',
      'Good general awareness.', 'Average awareness.', 'Weak awareness.', 'No awareness.'
    ),
  },
  // generic placeholder profile — any role without real content yet ("HOD to replace")
  {
    profile: 'generic', key: 'practical', name: '[PLACEHOLDER — HOD to replace] Practical / Trade Assessment',
    section: 'skill', weight: 15, order: 10, is_placeholder: true,
    anchors: L(
      'Demonstrated the core practical task for this role at an expert level.',
      'Performed the core task well with minor prompting.',
      'Basic competence, needs training.',
      'Struggled with the core practical task.',
      'Could not perform the core task.'
    ),
  },
  {
    profile: 'generic', key: 'groom', name: 'Grooming & Professional Presence', section: 'skill', weight: 10, order: 11,
    anchors: L(
      'Polished, hotel-ready; excellent posture, hygiene, etiquette.',
      'Well groomed and professional, minor improvements only.',
      'Meets minimum expectation, needs coaching.',
      'Below hospitality standard.',
      'Inconsistent with CP image.'
    ),
  },
  {
    profile: 'generic', key: 'roleknow', name: '[PLACEHOLDER — HOD to replace] Role / Technical Knowledge',
    section: 'know', weight: 10, order: 20, is_placeholder: true,
    anchors: L('Strong role-specific technical knowledge.', 'Good, minor gaps.', 'Basic.', 'Limited.', 'None.'),
  },
  {
    profile: 'generic', key: 'hosaware', name: 'Hospitality Awareness', section: 'know', weight: 5, order: 21,
    anchors: L('Strong industry awareness.', 'Good.', 'Average.', 'Weak.', 'None.'),
  }
);

export const USERS = [
  { name: 'HR Admin', email: 'hr@cph.in', role: 'hr_admin', department: 'Human Resources', designation: 'HR Manager', password: 'hr@2026' },
  { name: 'Rajesh Deshmukh', email: 'gm@cph.in', role: 'interviewer', department: 'Leadership', designation: 'General Manager', password: 'panel@2026' },
  { name: 'Meera Kulkarni', email: 'ops@cph.in', role: 'interviewer', department: 'Operations', designation: 'Operations Manager', password: 'panel@2026' },
  { name: 'Vikram Chaudhary', email: 'chef@cph.in', role: 'interviewer', department: 'Kitchen', designation: 'Executive Chef', password: 'panel@2026' },
  { name: 'Sunita Bhosale', email: 'admin@cph.in', role: 'interviewer', department: 'Admin', designation: 'Admin Head', password: 'panel@2026' },
  { name: 'Arjun Patil', email: 'fo@cph.in', role: 'interviewer', department: 'Front Office', designation: 'Front Office Executive', password: 'panel@2026' },
];
