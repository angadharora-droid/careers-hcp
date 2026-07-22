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
  // Commis-III appears on the HCP / CPNM / Pablo / Dali panel sheets as C3FP.
  { code: 'C3', meaning: 'Entry Associate / Commis III', present_at_cpa: false, panel_size: 2, order: 13 },
  { code: 'T', meaning: 'Trainee / Apprentice', present_at_cpa: false, panel_size: 2, order: 14 },
];

// CPA sanctioned strength — 26 designations, expands to 67 individual PCN seats.
// prof: competency profile key — the department's assessment content plus the grade
// variant. '_exec' is used from B1 upward because the assessment document reserves its
// crisis-management and manpower/budget questions for that level; '_assoc' at B2 and
// below. Every seated role carries one, so nothing falls back to the placeholders.
export const ROSTER = [
  { desig: 'General Manager', fam: 'Corporate Services', grade: 'A1', dept: 'Leadership', reports: 'Group / Ownership', count: 1, min: 150000, max: 250000, rev: true, guest: true, crit: true, prof: 'lead_exec' },
  { desig: 'Operations Manager', fam: 'Corporate Services', grade: 'A3', dept: 'Operations', reports: 'General Manager', count: 1, min: 30000, max: 65000, rev: true, guest: true, crit: true, prof: 'ops_exec' },
  { desig: 'Admin Head', fam: 'Administration', grade: 'A3', dept: 'Admin', reports: 'General Manager', count: 1, min: 30000, max: 65000, rev: false, guest: false, crit: true, prof: 'adm_exec' },
  { desig: 'Executive Chef', fam: 'Kitchen', grade: 'A3', dept: 'Kitchen', reports: 'General Manager', count: 1, min: 30000, max: 65000, rev: true, guest: false, crit: true, prof: 'kit_exec' },
  { desig: 'Front Office Executive', fam: 'Front Office', grade: 'B1', dept: 'Front Office', reports: 'Operations Manager', count: 1, min: 20000, max: 27000, rev: true, guest: true, crit: true, prof: 'fo_exec' },
  { desig: 'Admin Executive', fam: 'Administration', grade: 'B1', dept: 'Admin', reports: 'Admin Head', count: 2, min: 20000, max: 27000, rev: false, guest: false, crit: false, prof: 'adm_exec' },
  { desig: 'Security Executive', fam: 'Security', grade: 'B1', dept: 'Security', reports: 'Operations Manager', count: 1, min: 20000, max: 27000, rev: false, guest: false, crit: true, prof: 'sec_exec' },
  { desig: 'F&B Executive', fam: 'F&B Service', grade: 'B1', dept: 'F&B Service', reports: 'Operations Manager', count: 2, min: 20000, max: 27000, rev: true, guest: true, crit: true, prof: 'fb_exec' },
  { desig: 'Engineering Executive', fam: 'Engineering', grade: 'B1', dept: 'Engineering', reports: 'Operations Manager', count: 1, min: 20000, max: 27000, rev: false, guest: false, crit: true, prof: 'eng_exec' },
  { desig: 'Housekeeping Executive', fam: 'Housekeeping', grade: 'B1', dept: 'Housekeeping', reports: 'Operations Manager', count: 1, min: 20000, max: 27000, rev: false, guest: true, crit: true, prof: 'hk_exec' },
  { desig: 'Chef de Partie', fam: 'Kitchen', grade: 'B1', dept: 'Kitchen', reports: 'Executive Chef', count: 1, min: 22000, max: 32000, rev: true, guest: false, crit: false, prof: 'kit_exec' },
  { desig: 'Demi Chef de Partie', fam: 'Kitchen', grade: 'B2', dept: 'Kitchen', reports: 'Chef de Partie', count: 1, min: 18000, max: 25000, rev: true, guest: false, crit: false, prof: 'kit_assoc' },
  { desig: 'Team Leader — F&B', fam: 'F&B Service', grade: 'B2', dept: 'F&B Service', reports: 'F&B Executive', count: 2, min: 15000, max: 20000, rev: true, guest: true, crit: false, prof: 'fb_assoc' },
  { desig: 'Housekeeping Supervisor', fam: 'Housekeeping', grade: 'B2', dept: 'Housekeeping', reports: 'Housekeeping Executive', count: 2, min: 15000, max: 20000, rev: false, guest: true, crit: false, prof: 'hk_assoc' },
  { desig: 'Kitchen Stewarding Supervisor', fam: 'Kitchen', grade: 'B2', dept: 'Kitchen Stewarding', reports: 'Executive Chef', count: 1, min: 15000, max: 20000, rev: false, guest: false, crit: false, prof: 'kst_assoc' },
  { desig: 'Engineering Associate', fam: 'Engineering', grade: 'C1', dept: 'Engineering', reports: 'Engineering Executive', count: 2, min: 13000, max: 18000, rev: false, guest: false, crit: false, prof: 'eng_assoc' },
  { desig: 'Guest Service Associate — F&B', fam: 'F&B Service', grade: 'C1', dept: 'F&B Service', reports: 'Team Leader — F&B', count: 12, min: 13000, max: 18000, rev: true, guest: true, crit: false, prof: 'fb_assoc' },
  { desig: 'Senior Commis', fam: 'Kitchen', grade: 'C1', dept: 'Kitchen', reports: 'Chef de Partie', count: 5, min: 15000, max: 22000, rev: true, guest: false, crit: false, prof: 'kit_assoc' },
  { desig: 'Junior Commis', fam: 'Kitchen', grade: 'C2', dept: 'Kitchen', reports: 'Senior Commis', count: 5, min: 14000, max: 18000, rev: true, guest: false, crit: false, prof: 'kit_assoc' },
  { desig: 'Guest Service Associate — Front Office', fam: 'Front Office', grade: 'C1', dept: 'Front Office', reports: 'Front Office Executive', count: 3, min: 13000, max: 18000, rev: true, guest: true, crit: false, prof: 'fo_assoc' },
  { desig: 'Guest Service Associate — Housekeeping', fam: 'Housekeeping', grade: 'C1', dept: 'Housekeeping', reports: 'Housekeeping Supervisor', count: 9, min: 13000, max: 18000, rev: false, guest: true, crit: false, prof: 'hk_assoc' },
  { desig: 'Store Associate', fam: 'Purchase', grade: 'C1', dept: 'Stores', reports: 'Admin Head', count: 1, min: 13000, max: 18000, rev: false, guest: false, crit: false, prof: 'str_assoc' },
  { desig: 'Security Guard', fam: 'Security', grade: 'C1', dept: 'Security', reports: 'Security Executive', count: 3, min: 13000, max: 18000, rev: false, guest: true, crit: false, prof: 'sec_assoc' },
  // abbr 'VAL': Valet shares dept+grade (FO-C1) with GSA-Front Office — a distinct
  // sub-code keeps job_code role-unique so the Career Panel can't merge the two roles.
  // It is assessed on the document's Conveyance (Transport / Valet) content, not on
  // Front Office content, even though it is establishment-wise a Front Office seat.
  { desig: 'Guest Service Associate — Valet', fam: 'Front Office', grade: 'C1', dept: 'Front Office', abbr: 'VAL', reports: 'Front Office Executive', count: 2, min: 13000, max: 18000, rev: false, guest: true, crit: false, prof: 'val_assoc' },
  { desig: 'Bell Attendant', fam: 'Front Office', grade: 'C2', dept: 'Front Office', reports: 'Front Office Executive', count: 2, min: 12500, max: 14000, rev: false, guest: true, crit: false, prof: 'fo_assoc' },
  { desig: 'Kitchen Steward', fam: 'Kitchen', grade: 'C2', dept: 'Kitchen Stewarding', reports: 'Kitchen Stewarding Supervisor', count: 4, min: 12500, max: 14000, rev: false, guest: false, crit: false, prof: 'kst_assoc' },
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

/* ===== Department assessment content (hotel_assessment_criteria.docx) =====

   The document gives, per department, a Section B (Practical Assessment — Skills 25%)
   and a Section C (Knowledge 15%) but no rating scale; the five behavioural anchors
   below are written against each department's own tasks so a panellist grades what the
   candidate actually did, not a generic "performed the core task well".

   Section B tags no practical item as executive-only, so the skills block is identical
   at every grade within a department. Section C is what splits: an associate answers
   the two base questions, while a B1-and-above candidate answers the two '(Executive)'
   questions — crisis management and manpower/budget — in their place.

   Every profile is 3 skills + 2 knowledge. Section B's first two bullets (handle the
   scenario, then write it up) are one competency, because they are one event: a
   panellist watches the candidate resolve it and then reads what they wrote about it.
   The document's two executive questions are likewise scored as a single competency.

   Leadership, Operations and Kitchen Stewarding have no section in the document. CPA
   has seated roles at those desks, so they are written here on the same pattern and
   are the three profiles most worth an HOD review before a role goes live.

   Weights hold to the document's split for every profile:
     skills 25 = practical 10 + problem 10 + groom 5
     know  15 = deptknow 10 + hosaware 5   (associate)
     know  15 = deptknow 10 + execmgmt 5   (executive)                                */

// Grooming and hospitality awareness are not department-specific — one wording, used
// everywhere, so an HR edit to either lands consistently across the whole library.
const GROOM = L(
  'Polished and hotel-ready; excellent posture, hygiene and etiquette. Would be put in front of a guest on day one.',
  'Well groomed and professional, minor improvements only.',
  'Meets the minimum hospitality expectation, needs coaching.',
  'Grooming or body language below hospitality standard.',
  'Appearance or conduct inconsistent with the Centre Point image.'
);

const HOSAWARE = L(
  'Strong sense of the hospitality industry, brand awareness and the guest lifecycle; knew who Centre Point is and who we compete with.',
  'Good general awareness of the industry and the guest journey.',
  'Average awareness — knows the trade but not the market.',
  'Weak awareness; treats the job as generic work rather than hospitality.',
  'No awareness of the industry or of what a hotel guest expects.'
);

// The document's two executive questions — crisis management, and shift scheduling /
// manpower / budgeting — scored as one competency. It words them almost identically for
// every department, varying only the department name, so this follows that with a
// department-specific crisis example, escalation partners and deployment driver.
const EXECMGMT = (d) => L(
  `Walked a crisis end-to-end — ${d.crisis_eg} — in the right order: make safe, contain, inform, naming when ${d.partners} are pulled in and when police / fire / medical authorities are called. Equally clear on the routine side: ${d.label} rostering against ${d.deploy_eg}, absorbing leave and absenteeism without breaking service, and building and defending the departmental budget in numbers.`,
  `Sound crisis sequence with a clear escalation chain, and clear on rostering, manpower and the budget lines; minor gaps on one side or the other.`,
  `Knows a crisis must be escalated and roughly to whom, and can build a basic roster, but assembled both only with prompting and treats cost planning as reactive.`,
  `Vague on crisis protocol and limited on scheduling or budgeting; would improvise rather than follow protocol, and needs close supervision on manpower and cost.`,
  `No grasp of crisis management, of coordination beyond their own department, or of manpower and budget planning.`
);

const DEPT_ASSESSMENT = {
  /* ---------- Front Office / Guest Service ---------- */
  fo: {
    label: 'Front Office',
    know_name: 'Front Office Knowledge',
    practical_name: 'PMS Navigation, Phone & Radio Protocol',
    incident_name: 'Front-Desk Emergency Handling & Incident Report Writing',
    partners: 'Security, Housekeeping and Engineering',
    crisis_eg: 'a medical emergency in the lobby, a lost master key or a full evacuation',
    deploy_eg: 'the arrival/departure peaks and the occupancy forecast',
    practical: L(
      'Moved through check-in, check-out and a reservation amendment in the PMS without hesitation, including a rate or room-type change; phone and radio protocol was textbook — greeting, hold, call-back, clean hand-off.',
      'Completed the full PMS cycle with only minor prompting; phone and radio manner professional throughout.',
      'Managed a basic check-in and check-out but slowed on reservation changes; communication protocol usable, needs coaching.',
      'Needed step-by-step guidance through the system; phone or radio handling unclear and informal.',
      'Could not operate the front-desk system or follow basic communication protocol.'
    ),
    incident: L(
      'Took charge of the emergency — guest safety first, then escalation, then documentation. Named who to call in what order, kept the desk covered, and stayed audibly calm with other guests watching. The report that followed was complete and factual — time, location, persons involved, sequence, action taken, follow-up owner — with observation kept separate from opinion.',
      'Handled the scenario soundly with a clear sequence of actions, and the report covered every essential in clear language; minor gaps in escalation or a detail or two missing.',
      'Grasped the basic response but needed prompting on escalation or on protecting the guest first; the report recorded the basics and was thin on sequence or action taken, with some opinion written up as fact.',
      'Flustered; response disordered, or left the desk and the guest unattended while seeking help. Report vague or incomplete — it would not hold up if the guest escalated.',
      'No workable response to a front-desk emergency, and could not produce a usable written record of it.'
    ),
    know: L(
      'Explained the full check-in and check-out sequence including ID and registration requirements, and how a folio or room-status discrepancy is traced and corrected. Knew precisely what a guest incident report must contain.',
      'Good command of the arrival/departure cycle and of discrepancy handling; minor gaps.',
      'Knows the basic arrival and departure steps; vague on discrepancies or on what an incident report must include.',
      'Limited; unsure on most front-office fundamentals.',
      'No working front-office knowledge.'
    ),
    know_exec: L(
      'Explained check-in, check-out and discrepancy resolution from the supervisor’s seat — how a folio dispute, an overbooking or a shift cash variance is investigated, corrected, and written up for the record.',
      'Good supervisory command of the cycle and of discrepancy investigation; minor gaps.',
      'Solid on the fundamentals but weak on investigating a discrepancy or closing a shift cleanly.',
      'Limited; unsure on most executive-level front-office topics.',
      'No executive front-office knowledge.'
    ),
  },

  /* ---------- Housekeeping ---------- */
  hk: {
    label: 'Housekeeping',
    know_name: 'Housekeeping Knowledge',
    practical_name: 'Room Inspection, Room-Status System & Radio Protocol',
    incident_name: 'Complaint Handling & Lost-and-Found / Damage Report Writing',
    partners: 'Front Office, Engineering and Security',
    crisis_eg: 'a guest taken ill in a room, a serious in-room accident or an evacuation',
    deploy_eg: 'the occupancy forecast, departure load and rooms-per-attendant credit',
    practical: L(
      'Ran a full mock inspection to a checklist — bathroom, linen, amenities, high dusting, under the bed — updated room status correctly in the system and passed a clean radio hand-off to the desk.',
      'Inspected thoroughly and set room status correctly with minor prompting; radio manner professional.',
      'Covered the obvious areas and can set a room status, but missed detail points; radio protocol informal.',
      'Inspection superficial; needed guidance to update status or to use the radio correctly.',
      'Could not inspect a room to standard or operate the room-status system.'
    ),
    incident: L(
      'Owned the complaint — apologised without excuses, re-cleaned or raised it to Engineering at once, offered a room move where it was warranted, and closed the loop with the guest. The written record was complete — item or damage description, room and exact location, date and time, finder, witness, storage reference and release procedure — and knew that valuables and perishables are logged and held differently.',
      'Sound recovery with a clear fix and follow-up, and the record covered every essential clearly; minor gaps in closing the loop or a detail or two missing.',
      'Apologised and arranged a re-clean, but recovery was passive and follow-up left to chance; the record captured the basics and was thin on location, witness or custody trail.',
      'Defensive or deflecting; would leave the guest to chase the fix, and the record was vague enough that the item or damage could not be traced from it.',
      'No workable recovery, and could not produce a usable lost & found or damage record.'
    ),
    know: L(
      'Explained the departure-clean sequence, turnover timing against arrival pressure, and the supervisor quality check, plus exactly what a lost & found or damage report must record. Knew chemical dilution and colour-coded cloth discipline.',
      'Good command of cleaning, turnover and quality-check procedure; minor gaps.',
      'Knows the basic cleaning routine; vague on quality checks or on report contents.',
      'Limited; unsure on most housekeeping fundamentals.',
      'No working housekeeping knowledge.'
    ),
    know_exec: L(
      'Explained cleaning, turnover and quality-check standards from a supervisor’s seat — how rooms are credited and inspected, how a failed inspection is corrected and re-checked, and how linen and amenity par levels are controlled.',
      'Good supervisory command of standards and of inspection follow-up; minor gaps.',
      'Solid on the cleaning routine but weak on inspection discipline or par-level control.',
      'Limited; unsure on most executive-level housekeeping topics.',
      'No executive housekeeping knowledge.'
    ),
  },

  /* ---------- Food & Beverage Service ---------- */
  fb: {
    label: 'F&B Service',
    know_name: 'F&B Service Knowledge',
    practical_name: 'POS Operation & Kitchen–Service Communication',
    incident_name: 'Allergy / Accident Handling & Incident Report Writing',
    partners: 'the Kitchen, Front Office and Security',
    crisis_eg: 'an allergic reaction at the table or a suspected food-poisoning cluster',
    deploy_eg: 'covers forecast, outlet timings and banquet load',
    practical: L(
      'Punched a full order through the POS including a modifier and a split bill, and relayed it to the kitchen the way a real pass works — clear callout, confirmed pickup, checked the dish before it left. Settlement handled cleanly.',
      'Operated the POS confidently and communicated well with the kitchen; minor prompting.',
      'Managed a basic order on the POS but slowed on modifiers or settlement; kitchen communication one-directional.',
      'Needed guidance through the POS; order relay unclear enough to cause a wrong dish.',
      'Could not operate the POS or communicate an order to the kitchen.'
    ),
    incident: L(
      'Treated the allergy scenario as a medical event, not a service one — stopped service of the dish, escalated at once, secured the plate for investigation, and stayed with the guest; made the spillage area safe before anything else. The report was complete and factual — what was ordered and served, the declared allergy or the sequence of the accident, time, witnesses, action taken, medical help summoned, follow-up owner — and written with liability in mind.',
      'Sound response with the right priority on guest safety, and the report covered every essential in clear language; minor gaps in escalation, evidence handling or a missing detail.',
      'Grasped that it was serious and called for help, but the sequence was assembled with prompting; the report recorded the basics and was thin on sequence or action taken, with some opinion written up as fact.',
      'Flustered; treated a medical incident as a complaint, or cleared away the evidence. Report vague or incomplete — it would not stand up to a claim.',
      'No workable response — would put a guest at real risk — and could not produce a usable written record of it.'
    ),
    know: L(
      'Explained the hygiene steps that run through service — hand hygiene, holding temperatures, cross-contamination and allergen declaration at the table — and knew exactly what an incident report must include.',
      'Good command of food safety and hygiene during service; minor gaps.',
      'Knows the basic hygiene rules; vague on allergens or on report contents.',
      'Limited; unsure on most food-safety fundamentals.',
      'No working food-safety knowledge — unsafe on the floor.'
    ),
    know_exec: L(
      'Explained service-side food safety as the person accountable for it — how holding temperatures and allergen declarations are checked, how a hygiene failure is pulled up on the floor mid-service, and what is logged.',
      'Good supervisory command of hygiene standards and of correcting them live; minor gaps.',
      'Solid on the rules but weak on enforcing them across a team during service.',
      'Limited; unsure on most executive-level food-safety topics.',
      'No executive food-safety knowledge.'
    ),
  },

  /* ---------- Food Production (Kitchen) ---------- */
  kit: {
    label: 'Kitchen',
    know_name: 'Food Production Knowledge',
    practical_name: 'HACCP Procedure & Communication with Service',
    incident_name: 'Kitchen Emergency Handling & Food Safety Incident Report Writing',
    partners: 'F&B Service, Engineering and Security',
    crisis_eg: 'a kitchen fire, a gas leak or a contamination scare that reaches guests',
    deploy_eg: 'covers forecast, menu engineering and banquet load',
    practical: L(
      'Demonstrated HACCP in practice, not in theory — receiving checks, colour-coded boards, cooling and holding temperatures, labelling and stock rotation — and ran a clean pass with service: clear callout, confirmed pickup, dish checked before it left.',
      'Applied HACCP correctly with minor prompting; communication with service clear.',
      'Knows the main control points and can name them, but application was inconsistent; pass communication one-directional.',
      'Needed guidance on basic hygiene control; would let a temperature or labelling breach through.',
      'Could not demonstrate food safety procedure — unsafe in a working kitchen.'
    ),
    incident: L(
      'Took the kitchen emergency in the right order — isolate the source (gas, power, product), make people safe, then escalate. Named the right extinguisher for an oil fire and knew to quarantine, not discard, suspect product. The report was complete — product and batch, supplier, temperatures recorded, the control point that failed, who was informed, product quarantined or destroyed, corrective action — and written so an auditor could follow it.',
      'Sound response with correct priorities, and the report covered every essential clearly; minor gaps in escalation, in isolating the source, or a missing detail.',
      'Grasped the basic response but needed prompting on sequence or on the right suppression method; the report recorded the basics and was thin on the failed control point or on corrective action.',
      'Flustered; would fight a fire wrongly, or discard the evidence of a contamination. Report vague — it would not survive a food-safety audit.',
      'No workable response — would put the brigade and the guests at risk — and could not produce a usable food-safety record.'
    ),
    know: L(
      'Explained what happens in the first ten minutes of a food-safety incident or a kitchen fire — isolate, make safe, escalate, quarantine, record — and knew exactly what the incident report must contain.',
      'Good command of the incident response and of report contents; minor gaps.',
      'Knows the basics; vague on quarantine, on escalation or on report contents.',
      'Limited; unsure on most food-safety fundamentals.',
      'No working food-safety knowledge — unsafe in a kitchen.'
    ),
    know_exec: L(
      'Explained food-safety incident and fire response as the person accountable — the HACCP plan behind it, how a recall or a quarantine decision is made and defended, supplier follow-up, and what goes to the authorities.',
      'Good supervisory command of the HACCP plan and of incident escalation; minor gaps.',
      'Solid on the procedure but weak on owning a recall decision or on supplier follow-up.',
      'Limited; unsure on most executive-level food-safety topics.',
      'No executive food-safety knowledge.'
    ),
  },

  /* ---------- Facility (Engineering / Maintenance) ---------- */
  eng: {
    label: 'Engineering',
    know_name: 'Engineering & Maintenance Knowledge',
    practical_name: 'Maintenance Ticketing, Tools Handling & Radio Protocol',
    incident_name: 'Fire / Electrical Emergency Handling & Failure Report Writing',
    partners: 'Front Office, Housekeeping and Security',
    crisis_eg: 'a power failure, a lift entrapment or a fire-panel activation',
    deploy_eg: 'the preventive-maintenance calendar and shift coverage across 24 hours',
    practical: L(
      'Picked up a ticket, diagnosed aloud, and worked through it in the right order — isolate, lock out, repair, test, close the ticket with what was actually done. Tools handled safely and put back; radio hand-off clean.',
      'Worked the ticket competently and closed it properly with minor prompting; tool discipline good.',
      'Can carry out the repair but records it poorly; tool handling or isolation needs coaching.',
      'Needed guidance on isolation or on basic tool safety; tickets left open or uninformative.',
      'Could not work a maintenance ticket safely — would be a hazard to themselves or others.'
    ),
    incident: L(
      'Made the electrical scenario safe before touching anything — isolated at the source, confirmed dead, and only then worked. On the fire alarm, knew the panel, the zone, how to verify a genuine alarm and when not to reset it. The report was complete — asset and location, symptom, cause found, parts used, downtime, and whether it is a repeat failure needing a preventive change — written so the next technician could pick it up cold.',
      'Sound response with correct isolation and a clear sequence, and the report covered every essential clearly; minor gaps in escalation or a missing detail.',
      'Grasped the basic response but needed prompting on isolation or on verifying the alarm zone; the report recorded the basics and was thin on cause or downtime, so a repeat failure would not be visible.',
      'Flustered; would work live, or would silence a panel without verifying the zone. Report vague — the fault history could not be reconstructed from it.',
      'No workable response — would create a serious safety hazard — and could not produce a usable maintenance record.'
    ),
    know: L(
      'Explained the response to an equipment failure and to a fire emergency — isolate, make safe, escalate, restore, record — and knew exactly what a maintenance or incident report must capture.',
      'Good command of failure response and of report contents; minor gaps.',
      'Knows the basics; vague on isolation sequence or on report contents.',
      'Limited; unsure on most maintenance fundamentals.',
      'No working maintenance knowledge.'
    ),
    know_exec: L(
      'Explained failure and fire response as the person accountable — the preventive-maintenance regime behind it, statutory inspections and AMC obligations, how downtime is minimised during occupancy, and what is escalated to authorities.',
      'Good supervisory command of preventive maintenance and statutory obligations; minor gaps.',
      'Solid on repairs but weak on preventive planning or on statutory compliance.',
      'Limited; unsure on most executive-level engineering topics.',
      'No executive engineering knowledge.'
    ),
  },

  /* ---------- Security ---------- */
  sec: {
    label: 'Security',
    know_name: 'Security Knowledge',
    practical_name: 'CCTV, Access Control, Visitor Management & Radio Protocol',
    incident_name: 'Fire / Evacuation Handling & Incident Report Writing',
    partners: 'Front Office, Engineering and hotel management',
    crisis_eg: 'a fire evacuation, an intruder, a police matter or a death on the premises',
    deploy_eg: 'post coverage across 24 hours, patrol frequency and event load',
    practical: L(
      'Worked the CCTV bank purposefully — searched back to a timestamp, followed a subject across cameras, and knew what footage may be released and to whom. Access control and visitor logging were disciplined; radio protocol correct.',
      'Competent on CCTV, access control and visitor management with minor prompting; radio protocol correct.',
      'Can monitor cameras and log a visitor, but slow to retrieve footage; access control applied inconsistently.',
      'Needed guidance on the system; would let an unlogged visitor through.',
      'Could not operate CCTV or access control, or follow radio protocol.'
    ),
    incident: L(
      'Ran the evacuation properly — raised the alarm, worked to the assembly point, swept the assigned zone, accounted for guests and staff, and held the cordon for the fire service, knowing not to re-enter until cleared. The report was complete and neutral — date, time, exact location, persons involved with identification, sequence, witnesses, action taken, whether police were informed — written knowing it may become evidence.',
      'Sound evacuation response with a clear sequence, and the report covered every essential clearly and neutrally; minor gaps in sweeping, accounting or a missing detail.',
      'Knows to evacuate and where the assembly point is, but the zone sweep and roll call needed prompting; the report recorded the basics and was thin on witnesses or sequence, with some opinion written up as fact.',
      'Flustered; would evacuate without accounting for anyone, or would re-enter unsafely. Report vague or coloured by opinion — it would not stand up as evidence.',
      'No workable evacuation response — would endanger guests and staff — and could not produce a usable incident record.'
    ),
    know: L(
      'Explained the fire evacuation sequence, drew a clear line between routine patrol and incident response — patrol is prevention and presence, response is containment and evidence — and knew exactly what an incident report must include.',
      'Good command of evacuation, patrol discipline and report contents; minor gaps.',
      'Knows the basics; blurred the line between patrol and response, or vague on report contents.',
      'Limited; unsure on most security fundamentals.',
      'No working security knowledge.'
    ),
    know_exec: L(
      'Explained evacuation and incident response as the person accountable — the fire drill regime, liaison with police and fire authorities, chain of custody for footage and evidence, and statutory reporting obligations.',
      'Good supervisory command of drills, authority liaison and evidence handling; minor gaps.',
      'Solid on procedure but weak on authority liaison or on chain of custody.',
      'Limited; unsure on most executive-level security topics.',
      'No executive security knowledge.'
    ),
  },

  /* ---------- Conveyance (Transport / Valet) ---------- */
  val: {
    label: 'Conveyance',
    know_name: 'Conveyance & Valet Knowledge',
    practical_name: 'Vehicle Log / Dispatch System & Radio Protocol',
    incident_name: 'Transport Emergency Handling & Vehicle Incident Report Writing',
    partners: 'Front Office, Security and hotel management',
    crisis_eg: 'a guest injured in a vehicle accident or a transport failure during a VIP movement',
    deploy_eg: 'arrival and departure movements, airport runs and event traffic',
    practical: L(
      'Logged the vehicle properly — key tag, condition noted before taking custody, existing damage flagged to the guest, dispatch entry complete. Radio hand-off was clean and the key handling secure throughout.',
      'Logged and dispatched correctly with minor prompting; radio manner professional.',
      'Can log a vehicle but skipped a condition check or a dispatch entry; radio protocol informal.',
      'Needed guidance through the log; would take custody without recording condition.',
      'Could not operate the vehicle log or follow key-handling and radio protocol.'
    ),
    incident: L(
      'Put the guest first on the breakdown scenario — got them safe and comfortable, arranged the replacement vehicle before troubleshooting, informed the desk so the onward booking could be protected, then dealt with the vehicle. The report was complete and factual — vehicle and registration, driver, date, time and location, guest details, sequence of the accident, damage and injury, third parties, police informed, insurance intimation.',
      'Sound response with the right priority on the guest, and the report covered every essential clearly; minor gaps in informing the desk or a missing detail.',
      'Grasped the basic response but focused on the vehicle before the guest and needed prompting; the report recorded the basics and was thin on third parties, injury or the insurance step.',
      'Flustered; would leave the guest waiting without information or an alternative. Report vague — it would not support an insurance claim.',
      'No workable response — would strand a guest — and could not produce a usable vehicle incident record.'
    ),
    know: L(
      'Explained the steps for a breakdown and for an accident — guest safety, alternative arrangement, informing the hotel, police and insurance intimation, documentation — and knew what the vehicle incident report must contain. Clear on licence and vehicle-document validity.',
      'Good command of breakdown and accident procedure; minor gaps.',
      'Knows the basics; vague on insurance intimation or on report contents.',
      'Limited; unsure on most conveyance fundamentals.',
      'No working conveyance knowledge.'
    ),
  },

  /* ---------- Store ---------- */
  str: {
    label: 'Stores',
    know_name: 'Stores & Inventory Knowledge',
    practical_name: 'Inventory Management System & Issuance Protocol',
    incident_name: 'Shortage / Spoilage Handling & Inventory Discrepancy Report Writing',
    partners: 'Purchase, the Kitchen and Finance',
    crisis_eg: 'a spoilage event across a cold store or a stock loss found during audit',
    deploy_eg: 'receiving windows, issue timings and month-end stock-take',
    practical: L(
      'Received against the purchase order properly — checked quantity, quality, weight and expiry before signing, raised a short-supply note, and posted receipt and issue in the system so the physical and book stock agreed. FIFO applied without being asked.',
      'Received and issued correctly with minor prompting; system entries accurate.',
      'Can receive and issue but checks are cursory; system entries lag the physical movement.',
      'Needed guidance on the system; would sign for goods without a proper check.',
      'Could not operate the inventory system or follow issuance protocol.'
    ),
    incident: L(
      'Handled the shortage without letting the kitchen stop — flagged it early with a realistic timeline, proposed a substitute or an emergency purchase, and escalated to Purchase in writing; on spoilage, quarantined and recorded before disposing. The report was complete — item, code, batch, quantity booked against quantity found, the variance and its likely cause, supplier or department involved, corrective action — written so Finance could reconcile from it.',
      'Sound response with early escalation, and the report covered every essential clearly; minor gaps in the written trail or a missing detail.',
      'Grasped the problem but escalated late or verbally only, and substitution was not thought through; the report recorded the variance but was thin on cause or corrective action.',
      'Would absorb the shortage silently until a department was left without stock. Report vague — the discrepancy could not be reconciled from it.',
      'No workable response — would disguise a shortage or dispose of spoilage unrecorded — and could not produce a usable discrepancy record.'
    ),
    know: L(
      'Explained receiving, storage and issuance end to end — PO matching, quality and expiry checks, FIFO, segregation and temperature discipline, indent-based issue, and periodic stock-take — and knew what a stock discrepancy report must record.',
      'Good command of the receive–store–issue cycle; minor gaps.',
      'Knows the basic cycle; vague on FIFO discipline, stock-take or report contents.',
      'Limited; unsure on most stores fundamentals.',
      'No working stores knowledge.'
    ),
  },

  /* ---------- Kitchen Stewarding (no section in the document — built on its pattern) ---------- */
  kst: {
    label: 'Kitchen Stewarding',
    know_name: 'Kitchen Stewarding Knowledge',
    practical_name: 'Dishwash Cycle, Chemical Dilution & Equipment Handling',
    incident_name: 'Chemical Spill / Machine Failure Handling & Breakage Report Writing',
    partners: 'the Kitchen, Engineering and Stores',
    crisis_eg: 'a chemical spill or burn injury, or a dishwash failure mid-service',
    deploy_eg: 'covers forecast, outlet timings and banquet load',
    practical: L(
      'Ran the dishwash cycle to standard — scrape, pre-rinse, correct rack, wash and rinse temperatures checked, air-dried, stored inverted. Diluted chemicals to the stated ratio with PPE on, and handled glassware and pans without risking breakage.',
      'Ran the cycle correctly with minor prompting; chemical dilution and PPE discipline good.',
      'Knows the cycle but skipped temperature checks or eyeballed the dilution; needs coaching.',
      'Needed guidance on the cycle; would mix chemicals without measuring or PPE.',
      'Could not run the dishwash cycle safely — a chemical or hygiene hazard.'
    ),
    incident: L(
      'On the chemical spill, made the area safe first — cordoned, ventilated, PPE, correct neutralising step — and knew where the safety data sheet lives; on a machine failure mid-service, switched to the manual routine and raised the ticket at once. The report was complete — item and quantity broken, outlet, shift, how it happened, whether injury resulted, chemical consumption against issue — written so recurring breakage or over-consumption would show up.',
      'Sound response with the right safety priority, and the report covered every essential clearly; minor gaps in escalation or a missing detail.',
      'Grasped that it was serious but needed prompting on the sequence or on the safety data sheet; the report recorded the breakage but was thin on cause or chemical consumption.',
      'Flustered; would clean a chemical spill bare-handed, or let service stall without escalating. Report vague — a recurring loss would go unnoticed.',
      'No workable response — would create a serious safety hazard — and could not produce a usable breakage or consumption record.'
    ),
    know: L(
      'Explained wash and rinse temperature standards, chemical dilution and safe storage, colour-coded segregation, waste segregation and pest-control discipline, and how stewarding supports the kitchen’s HACCP plan.',
      'Good command of hygiene, chemical and waste discipline; minor gaps.',
      'Knows the basic routine; vague on temperatures, dilution ratios or waste segregation.',
      'Limited; unsure on most stewarding fundamentals.',
      'No working stewarding knowledge — unsafe around chemicals.'
    ),
  },

  /* ---------- Admin ---------- */
  adm: {
    label: 'Admin',
    know_name: 'Administration Knowledge',
    practical_name: 'Office Software & Internal Communication Protocol',
    incident_name: 'Confidentiality Incident Handling & Discrepancy Report Writing',
    partners: 'HR, Finance and hotel management',
    crisis_eg: 'a data-confidentiality breach, a statutory inspection or a licence lapse',
    deploy_eg: 'statutory calendars, audit dates and departmental support load',
    practical: L(
      'Worked comfortably across spreadsheet, document and mail — built a tracker with formulas that held up, drafted a clean internal circular, and routed it correctly with the right people in copy and a clear action owner.',
      'Competent across office software with minor prompting; internal communication clear and correctly routed.',
      'Can produce basic documents but formulas or formatting need help; circulars unclear on who must act.',
      'Needed guidance on routine software; internal communication disorganised.',
      'Could not use office software or route internal communication.'
    ),
    incident: L(
      'Treated the confidentiality breach seriously — contained access first, informed management immediately rather than trying to fix it quietly, preserved the trail, and knew which records carry a statutory obligation. The report was complete — what the discrepancy is, records and dates involved, who raised it, verification done, the gap identified, corrective and preventive action — written so an auditor could follow it.',
      'Sound response with prompt escalation, and the report covered every essential clearly; minor gaps in containment, in preserving the trail, or a missing detail.',
      'Recognised it as serious but would have delayed escalation or handled it informally; the report recorded the discrepancy but was thin on verification or preventive action.',
      'Would try to resolve a breach quietly, or discuss confidential records with the wrong people. Report vague — the discrepancy could not be traced or closed from it.',
      'No grasp of confidentiality — a data risk in the role — and could not produce a usable administrative record.'
    ),
    know_exec: L(
      'Explained documentation, filing and record-keeping as the person accountable — retention periods and what is statutory, version and access control, an audit-ready filing structure, and how licence and contract renewals are tracked so nothing lapses.',
      'Good supervisory command of records, retention and renewal tracking; minor gaps.',
      'Solid on filing but weak on retention obligations or on renewal tracking.',
      'Limited; unsure on most executive-level administration topics.',
      'No executive administration knowledge.'
    ),
  },

  /* ---------- Operations (no section in the document — built on its pattern) ---------- */
  ops: {
    label: 'Operations',
    know_name: 'Hotel Operations Knowledge',
    practical_name: 'Morning Briefing, Occupancy-Driven Deployment & Ops Dashboard',
    incident_name: 'Multi-Department Failure Handling & Shift Report Writing',
    partners: 'every department head, and police / fire / medical authorities',
    crisis_eg: 'a property-wide failure — power, fire, or a mass-guest incident',
    deploy_eg: 'the occupancy forecast and the load across all departments',
    practical: L(
      'Read the day’s pack — occupancy, arrivals, VIPs, out-of-order rooms, events — and ran a mock briefing that assigned specific, checkable actions by department. Deployment decisions were justified with numbers, not instinct.',
      'Ran a competent briefing and deployed sensibly against the day’s load; minor prompting.',
      'Can read the pack and brief, but actions were general and deployment was reactive.',
      'Struggled to translate the day’s data into department actions; briefing had no owners.',
      'Could not run an operational briefing or plan deployment.'
    ),
    incident: L(
      'Took command of the multi-department failure — established what was affected, protected life and then revenue, gave each HOD a clear task and a reporting time, set a single point of guest communication, and escalated to the GM and to authorities at the right threshold. The shift report was complete — occupancy and revenue, incidents with action taken and owners, out-of-order items, guest complaints and their resolution, what carries forward — and readable in two minutes by the GM.',
      'Sound command with clear tasking, and the report covered every essential clearly; minor gaps in guest communication, escalation timing or a missing detail.',
      'Coordinated the response but tasking was loose and guest communication was left to individual desks; the report recorded events but was thin on action taken or on what carries forward.',
      'Would work one department at a time while the rest of the property drifted. Report vague — the next shift could not pick up from it.',
      'No workable command of a cross-department failure, and could not produce a usable operations record.'
    ),
    know_exec: L(
      'Explained how the departments interlock across the guest journey — where the hand-offs fail between Front Office, Housekeeping, F&B and Engineering — and how SOPs, standards audits and guest-feedback scores are used to hold the line. Talked in operating metrics.',
      'Good command of inter-departmental operations and of the standards regime; minor gaps.',
      'Understands the departments individually but weak on the hand-offs between them.',
      'Limited; sees operations as a set of separate departments.',
      'No working knowledge of hotel operations as a whole.'
    ),
  },

  /* ---------- Leadership (no section in the document — built on its pattern) ---------- */
  lead: {
    label: 'Leadership',
    know_name: 'Business & Enterprise Leadership Knowledge',
    practical_name: 'P&L Review & Departmental Performance Challenge',
    incident_name: 'Property-Level Crisis Command & Ownership Escalation Note',
    partners: 'ownership, every department head, and police / fire / medical authorities',
    crisis_eg: 'a fire, a fatality, a police matter or a reputational incident that reaches the press',
    deploy_eg: 'the annual business plan, occupancy forecast and the full establishment',
    practical: L(
      'Read the P&L and the occupancy / ADR / RevPAR pack and went straight to the two lines that mattered, with a hypothesis for each. Ran a mock departmental review that was specific and evidence-based — challenged the number, agreed an action and a date.',
      'Read the pack accurately and challenged performance credibly; minor gaps in the review.',
      'Understands the numbers but the review stayed descriptive rather than driving a decision.',
      'Struggled to interpret the pack or to hold a department to account for a variance.',
      'Could not read a hotel P&L or run a performance review.'
    ),
    incident: L(
      'Took command as the accountable person — protected life first, took control of external communication personally, informed ownership early with facts rather than reassurance, and preserved the record knowing it may be scrutinised. The escalation note was complete and unvarnished — what happened, exposure, action taken, what is still open, what is recommended — with no burying of bad news, a clear ask and a clear decision owner.',
      'Sound crisis command with early ownership contact, and the note covered every essential clearly with a defined ask; minor gaps in external communication or a missing detail.',
      'Would manage the incident but delegate external and ownership communication too far down; the note reported the facts but was soft on exposure or unclear on what decision is needed.',
      'Would delay informing ownership, or improvise a statement to the press. Note vague or defensive — ownership could not act on it.',
      'No workable crisis command — would expose the property legally and reputationally — and could not produce a usable report to ownership.'
    ),
    know_exec: L(
      'Owns the commercial picture — P&L and departmental margins, rate and revenue strategy against the competition set, statutory and licensing compliance, brand standards, and people cost against establishment. Spoke about the hotel as a business, not as a set of departments.',
      'Strong commercial and compliance command with minor gaps.',
      'Solid operationally but thin on commercial strategy or on statutory compliance.',
      'Limited; would run the property operationally without owning the business result.',
      'No enterprise-leadership knowledge; not equipped to run a unit.'
    ),
  },
};

// Variants each department actually has a seated role for at CPA. A department with no
// variant here — or a new position HR creates before its profile is written — falls
// through to the 'generic' placeholders below.
const PROFILE_VARIANTS = {
  fo: ['assoc', 'exec'],
  hk: ['assoc', 'exec'],
  fb: ['assoc', 'exec'],
  kit: ['assoc', 'exec'],
  eng: ['assoc', 'exec'],
  sec: ['assoc', 'exec'],
  val: ['assoc'],
  str: ['assoc'],
  kst: ['assoc'],
  adm: ['exec'],
  ops: ['exec'],
  lead: ['exec'],
};

function buildProfile(base, variant, d) {
  const profile = `${base}_${variant}`;
  const rows = [
    { profile, key: 'practical', name: `Practical Assessment — ${d.practical_name}`, section: 'skill', weight: 10, order: 10, anchors: d.practical },
    { profile, key: 'problem', name: d.incident_name, section: 'skill', weight: 10, order: 11, anchors: d.incident },
    { profile, key: 'groom', name: 'Grooming & Professional Presence', section: 'skill', weight: 5, order: 12, anchors: GROOM },
  ];
  if (variant === 'exec') {
    rows.push(
      { profile, key: 'deptknow', name: `${d.know_name} (Executive)`, section: 'know', weight: 10, order: 20, anchors: d.know_exec },
      { profile, key: 'execmgmt', name: 'Crisis Management, Manpower Deployment & Budgeting', section: 'know', weight: 5, order: 21, anchors: EXECMGMT(d) }
    );
  } else {
    rows.push(
      { profile, key: 'deptknow', name: d.know_name, section: 'know', weight: 10, order: 20, anchors: d.know },
      { profile, key: 'hosaware', name: 'Hospitality Awareness', section: 'know', weight: 5, order: 21, anchors: HOSAWARE }
    );
  }
  return rows;
}

for (const [base, variants] of Object.entries(PROFILE_VARIANTS)) {
  for (const v of variants) COMPETENCIES.push(...buildProfile(base, v, DEPT_ASSESSMENT[base]));
}

// Generic placeholder profile — the safety net for a position created before its
// department profile exists. No seeded CPA role uses it any more.
COMPETENCIES.push(
  {
    profile: 'generic', key: 'practical', name: '[PLACEHOLDER — HOD to replace] Practical / Trade Assessment',
    section: 'skill', weight: 10, order: 10, is_placeholder: true,
    anchors: L(
      'Demonstrated the core practical task for this role at an expert level.',
      'Performed the core task well with minor prompting.',
      'Basic competence, needs training.',
      'Struggled with the core practical task.',
      'Could not perform the core task.'
    ),
  },
  {
    profile: 'generic', key: 'problem', name: '[PLACEHOLDER — HOD to replace] Incident Handling & Report Writing',
    section: 'skill', weight: 10, order: 11, is_placeholder: true,
    anchors: L(
      'Handled the scenario calmly and in the right order, with clear ownership and escalation, and the report that followed was complete and factual — time, place, persons, sequence, action taken, follow-up owner.',
      'Sound response with a clear sequence of actions, and the report covered every essential clearly; minor gaps or a missing detail.',
      'Grasped the basic response but needed prompting on sequence or escalation; the report recorded the basics and was thin on sequence or action taken.',
      'Flustered; response disordered or ownership deflected, and the report was vague or incomplete.',
      'No workable response to the scenario, and could not produce a usable written record.'
    ),
  },
  {
    profile: 'generic', key: 'groom', name: 'Grooming & Professional Presence',
    section: 'skill', weight: 5, order: 12, anchors: GROOM,
  },
  {
    profile: 'generic', key: 'deptknow', name: '[PLACEHOLDER — HOD to replace] Role / Technical Knowledge',
    section: 'know', weight: 10, order: 20, is_placeholder: true,
    anchors: L('Strong role-specific technical knowledge.', 'Good, minor gaps.', 'Basic.', 'Limited.', 'None.'),
  },
  {
    profile: 'generic', key: 'hosaware', name: 'Hospitality Awareness',
    section: 'know', weight: 5, order: 21, anchors: HOSAWARE,
  }
);

// Interviewer logins are no longer invented here — they come from the real panel in
// seed/panelData.js (transcribed from Interview_Panel.xlsx). Only the HR Panel login
// is seeded directly.
export const USERS = [
  { name: 'HR Admin', email: 'hr@cph.in', roles: ['hr_admin'], department: 'Human Resources', designation: 'HR Manager', password: 'hr@2026' },
];
