/* Interview panel matrix — transcribed from Interview_Panel.xlsx (5 unit sheets).

   The workbook's "PANEL 1 / PANEL 2 / PANEL 3" columns are ROUNDS, not three
   people sitting together: Panel 1 = Round 1, Panel 2 = Round 2, Panel 3 = Round 3.
   The same person legitimately appears in more than one round (e.g. Parag takes
   Round 1 and Round 3 on every A-grade row).

   Two sheet conventions are normalised here:
   - The "FP" grade suffix (B1FP, A3FP, C2FP…) is not a separate grade — it is the
     Food Production variant of that grade. Stored as grade + department.
   - "ALL DEPARTMENT" becomes dept '*', which the resolver treats as a fallback. */

export const UNITS = [
  { code: 'HCP',   name: 'Hotel Centre Point, Nagpur' },
  { code: 'CPA',   name: 'Centre Point Amravati' },
  { code: 'CPNM',  name: 'Centre Point Navi Mumbai' },
  { code: 'PABLO', name: 'Pablo' },
  { code: 'DALI',  name: 'Dali' },
];

/* Departments on the HCP and CPNM sheets are written as bare numbers whose legend
   was NOT in the workbook (Sheet3 is empty). Four are inferable from the panellist's
   own email address; the rest are unknown and left blank on purpose — a wrong guess
   would silently route a candidate to the wrong interviewer.

   Fill a code in and every rule carrying it resolves automatically. Rules whose code
   is still blank simply never match, so auto-assign falls through to manual. */
export const DEPT_CODE_MAP = {
  15: 'F&B Service',        // panellist is fnb.nagpur@cpgh.in
  20: 'Human Resources',    // panellist is hr.units@cpgh.in
  25: 'Kitchen',            // Food Production sub-rows only ever list the chef
  16: '', 17: '', 18: '', 19: '', 21: '', 22: '', 23: '', 37: '', 100: '',
};

/* ===== Panellists =====
   email: taken verbatim from the workbook's EMAIL column where one exists.
   Everyone else gets a role-based shared id, so the login survives the person
   changing — matching how the sheet itself names some slots by title
   ("EXECUTIVE SOUS CHEF", "OPRATION MANAGER") rather than by name.
   `note` records where a name/email pairing is an inference rather than a fact.

   `hr: true` also grants the HR Panel on the same login. Parag, Rajkumar and the
   recruiter run recruitment as well as sitting on panels, so they hold both roles
   rather than juggling two accounts. */
export const PANEL_USERS = [
  // --- Corporate: sit on panels across every unit ---
  { key: 'parag',      name: 'Parag',             email: 'cso.nagpur@cpgh.in',    designation: 'Chief Operating Officer', department: 'Corporate', unit: '*', hr: true },
  { key: 'arjun',      name: 'Arjun Arora',       email: 'arjun.arora@cpgh.in',   designation: 'Director',                department: 'Corporate', unit: '*' },
  { key: 'angadh',     name: 'Angadh Arora',      email: 'angadh.arora@cpgh.in',  designation: 'Director',                department: 'Corporate', unit: '*' },
  { key: 'rajkumar',   name: 'Rajkumar',          email: 'hr.units@cpgh.in',      designation: 'HR — Units',              department: 'Human Resources', unit: '*', hr: true },
  // The three recruiters share one login: any of them may take the round.
  { key: 'recruiter',  name: 'HR Recruiter',      email: 'recruiter@cpgh.in',     designation: 'HR Recruiter (shared — 3 recruiters)', department: 'Human Resources', unit: '*', hr: true },

  // --- Hotel Centre Point, Nagpur ---
  // HR confirmed: the CPA job catalogue's "Amit Sir" is this person (Amit Khandwal),
  // and its "Amit Chakrborty" is amit_c below — two different people.
  { key: 'amit_kandwal', name: 'Amit Kandwal',       email: 'gm.nagpur@cpgh.in',  designation: 'General Manager',            department: 'Leadership',  unit: 'HCP' },
  { key: 'devendra',     name: 'Devendra Shirudkar', email: 'bom.nagpur@cpgh.in', designation: 'Banquet Operations Manager', department: 'Banquet',     unit: 'HCP' },
  { key: 'veerendra',    name: 'Veerendra Singh',    email: 'fnb.nagpur@cpgh.in', designation: 'F&B Manager',                department: 'F&B Service', unit: 'HCP' },
  { key: 'debraj',       name: 'Debraj Das',         email: 'execchef.hcp@cpgh.in', designation: 'Executive Chef',           department: 'Kitchen',     unit: 'HCP' },
  // HOD ids are keyed to the department code because the code's meaning is unknown.
  // Rename the email once DEPT_CODE_MAP is filled in.
  { key: 'sudhir',     name: 'Sudhir Tupone',     email: 'hod.d16.hcp@cpgh.in', designation: 'HOD — dept code 16', department: '', unit: 'HCP', note: 'department code 16 unresolved' },
  { key: 'ritesh',     name: 'Ritesh Nirmalkar',  email: 'hod.d17.hcp@cpgh.in', designation: 'HOD — dept code 17', department: '', unit: 'HCP', note: 'department code 17 unresolved' },
  { key: 'dharmendra', name: 'Dharmendra',        email: 'hod.d18.hcp@cpgh.in', designation: 'HOD — dept code 18', department: '', unit: 'HCP', note: 'department code 18 unresolved' },
  { key: 'vinay',      name: 'Vinay Mishra',      email: 'hod.d19.hcp@cpgh.in', designation: 'HOD — dept code 19', department: '', unit: 'HCP', note: 'department code 19 unresolved' },
  { key: 'anirudhha',  name: 'Anirudhha',         email: 'hod.d21.hcp@cpgh.in', designation: 'HOD — dept codes 21 / 37', department: '', unit: 'HCP', note: 'appears as code 21 on B2/C1 rows and code 37 on B1 rows' },
  { key: 'mohanish',   name: 'Mohanish',          email: 'hod.d22.hcp@cpgh.in', designation: 'HOD — dept code 22', department: '', unit: 'HCP', note: 'department code 22 unresolved' },
  { key: 'shivesh',    name: 'Shivesh',           email: 'hod.d23.hcp@cpgh.in', designation: 'HOD — dept code 23', department: '', unit: 'HCP', note: 'department code 23 unresolved' },

  // --- Centre Point Amravati ---
  // HR confirmed: the CPA job catalogue's "Ashish Sir" is this person. Its
  // "Ashish Gudankwar" is somebody else entirely and has no account yet.
  { key: 'ashish_kamble', name: 'Ashish Kamble',  email: 'gm.cpa@cpgh.in',          designation: 'General Manager',     department: 'Leadership', unit: 'CPA', note: 'GM role inferred — occupies the same Round 2 slot Amit Kandwal (GM) holds on the HCP sheet' },
  { key: 'ashish_h',      name: 'Ashish',         email: 'hrexe@cpgh.in',           designation: 'HR Executive',        department: 'Human Resources', unit: 'CPA', note: "listed as 'ASHISH H' beside hrexe@cpgh.in; not on any panel row" },
  { key: 'avinash',       name: 'Avinash Rawat',  email: 'execchef.cpa@cpgh.in',    designation: 'Executive Chef',      department: 'Kitchen', unit: 'CPA' },
  { key: 'ravikant',      name: 'Ravikant Sharma', email: 'opsmanager.cpa@cpgh.in', designation: 'Operations Manager',  department: 'Operations', unit: 'CPA', note: 'covers every non-Food-Production B/C row at CPA' },
  { key: 'execsous_cpa',  name: 'Executive Sous Chef — CPA', email: 'execsouschef.cpa@cpgh.in', designation: 'Executive Sous Chef', department: 'Kitchen', unit: 'CPA' },

  // --- Centre Point Navi Mumbai ---
  { key: 'amit_c',       name: 'Amit Cakraborty',       email: 'gm.cpnm@cpgh.in',        designation: 'General Manager',    department: 'Leadership', unit: 'CPNM', note: 'GM role inferred from the Round 2 slot' },
  { key: 'opsmgr_cpnm',  name: 'Operations Manager — CPNM', email: 'opsmanager.cpnm@cpgh.in', designation: 'Operations Manager', department: 'Operations', unit: 'CPNM' },
  { key: 'souschef_cpnm', name: 'Sous Chef — CPNM',     email: 'souschef.cpnm@cpgh.in',  designation: 'Sous Chef',          department: 'Kitchen', unit: 'CPNM' },

  // --- Pablo ---
  { key: 'irfan',    name: 'Irfan Khan',     email: 'rm.pablo@cpgh.in',   designation: 'Restaurant Manager', department: 'F&B Service', unit: 'PABLO' },
  { key: 'narendra', name: 'Narendra Singh', email: 'chef.pablo@cpgh.in', designation: 'Chef de Cuisine',    department: 'Kitchen',     unit: 'PABLO' },

  // --- Dali ---
  { key: 'sandeep', name: 'Sandeep Singh', email: 'rm.dali@cpgh.in',   designation: 'Restaurant Manager', department: 'F&B Service', unit: 'DALI', note: "sheet spells this 'SANSEEP SINGH' in the panel column and 'SANDEEP' in the legend" },
  { key: 'mohsin',  name: 'Mohsin Khan',   email: 'chef.dali@cpgh.in', designation: 'Chef de Cuisine',    department: 'Kitchen',     unit: 'DALI' },
];

/* Sheet department wording → the department names used by Position/Application. */
export const DEPT_ALIASES = {
  'FOOD PRODUCTION': 'Kitchen',
  'KST': 'Kitchen Stewarding',
  'F&B SERVICE': 'F&B Service',
  'HOUSEKEEPING': 'Housekeeping',
  'VALLET': 'Front Office',        // the CPA roster files valets under Front Office
  'BANQUET': 'Banquet',
  'ROOM DIVISION': ['Front Office', 'Housekeeping'],
  'ADMIN': 'Admin',
  'ALL DEPARTMENT': '*',
};

/* ===== Rule builder =====
   r(unit, grade, dept, rounds, deptCode) → one or more rule objects.
   `rounds` is an array of round entries: a string key, or 'a|b' when the sheet
   offers a choice of panellist ("ARJUN SIR/ANGADH SIR") — the first is the
   default and the rest are recorded as alternates. */
const rules = [];
function r(unit, grade, dept, rounds, dept_code = '') {
  const depts = Array.isArray(dept) ? dept : [dept];
  for (const d of depts) {
    rules.push({
      unit, grade, dept: d, dept_code: String(dept_code || ''),
      rounds: rounds.map((spec, i) => {
        const [key, ...alternates] = String(spec).split('|');
        return { round: i + 1, key, alternates };
      }),
    });
  }
}

/* --- Hotel Centre Point, Nagpur --- */
r('HCP', 'A1', 'Admin',   ['parag', 'arjun|angadh', 'parag']);
r('HCP', 'A2', '*',       ['parag', 'amit_kandwal', 'arjun|angadh']);
// Sheet row 6 writes 'EXECUTIVE CHEF' in the grade column; it carries the same
// panel as the A2/HOD row above, so it is recorded as A2 + Kitchen.
r('HCP', 'A2', 'Kitchen', ['parag', 'amit_kandwal', 'arjun|angadh']);
r('HCP', 'A3', '*',       ['parag', 'amit_kandwal', 'parag']);
r('HCP', 'A3', 'Kitchen', ['parag', 'amit_kandwal', 'parag']);
r('HCP', 'A4', '*',       ['rajkumar', 'amit_kandwal', 'rajkumar']);
r('HCP', 'A4', 'Kitchen', ['rajkumar', 'amit_kandwal', 'rajkumar']);

// B/C rows: Round 1 is the department's own HOD, Round 2 is the shared recruiter.
const HCP_HODS = [
  ['Banquet', 'devendra', ''],
  ['', 'veerendra', 15], ['', 'sudhir', 16], ['', 'ritesh', 17], ['', 'dharmendra', 18],
  ['', 'vinay', 19], ['', 'rajkumar', 20], ['', 'anirudhha', 21], ['', 'mohanish', 22],
  ['', 'shivesh', 23],
];
for (const grade of ['B1', 'B2', 'C1']) {
  for (const [dept, key, code] of HCP_HODS) {
    // An unresolved code parks the rule under '?<code>' so it stays distinct and
    // never matches a real department by accident.
    r('HCP', grade, DEPT_CODE_MAP[code] || dept || `?${code}`, [key, 'recruiter'], code);
  }
  r('HCP', grade, 'Kitchen', ['debraj', 'recruiter'], 25);
}
r('HCP', 'C2', 'Kitchen', ['debraj', 'recruiter'], 25);
r('HCP', 'C3', 'Kitchen', ['debraj', 'recruiter'], 25);
r('HCP', 'T',  '*',       ['recruiter']);

/* --- Centre Point Amravati ---
   Every non-Food-Production B/C sub-row repeats Ravikant Sharma, so these are
   recorded as '*' (any department) instead of one rule per department code. */
r('CPA', 'A1', 'Admin',   ['parag', 'arjun|angadh', 'parag']);
r('CPA', 'A3', '*',       ['parag', 'ashish_kamble', 'parag']);
r('CPA', 'A3', 'Kitchen', ['parag', 'ashish_kamble|avinash', 'parag']);
for (const grade of ['B1', 'B2', 'C1', 'C2']) {
  r('CPA', grade, '*',       ['ravikant', 'recruiter']);
  r('CPA', grade, 'Kitchen', ['execsous_cpa', 'recruiter']);
}
r('CPA', 'T', '*', ['recruiter']);

/* --- Centre Point Navi Mumbai --- */
r('CPNM', 'A1', 'Admin',   ['parag', 'arjun|angadh', 'parag']);
r('CPNM', 'A3', '*',       ['parag', 'amit_c', 'parag']);
r('CPNM', 'A4', '*',       ['rajkumar', 'amit_c', 'rajkumar']);
r('CPNM', 'A4', 'Kitchen', ['rajkumar', 'amit_c', 'rajkumar']);
for (const grade of ['B1', 'B2', 'C1', 'C2', 'C3']) {
  r('CPNM', grade, '*',       ['opsmgr_cpnm', 'recruiter']);
  r('CPNM', grade, 'Kitchen', ['souschef_cpnm', 'recruiter']);
}
r('CPNM', 'C2', 'Kitchen Stewarding', ['souschef_cpnm', 'recruiter'], 100);
r('CPNM', 'T', '*', ['recruiter']);

/* --- Pablo & Dali: identical shape, one F&B lead and one kitchen lead --- */
for (const [unit, fb, chef] of [['PABLO', 'irfan', 'narendra'], ['DALI', 'sandeep', 'mohsin']]) {
  r(unit, 'A3', 'F&B Service', ['parag', 'arjun|angadh', 'parag']);
  r(unit, 'A3', 'Kitchen',     ['parag', 'arjun|angadh', 'parag']);
  r(unit, 'B1', 'F&B Service', [fb, 'recruiter']);
  r(unit, 'B1', 'Kitchen',     [chef, 'recruiter']);
  r(unit, 'B2', 'F&B Service', [fb, 'recruiter']);
  r(unit, 'B2', 'Kitchen',     [chef, 'recruiter']);
  r(unit, 'C1', ['F&B Service', 'Housekeeping'], [fb, 'recruiter']);
  r(unit, 'C1', ['Kitchen', 'Kitchen Stewarding'], [chef, 'recruiter']);
  r(unit, 'C2', 'Kitchen',     [fb, 'recruiter']);   // sheet lists the F&B lead on COMMI-II
  r(unit, 'C3', 'Kitchen',     [chef, 'recruiter']);
  r(unit, 'T',  '*',           ['recruiter']);
}
// Pablo's C1 rank & file row also covers valets; Dali's does not.
r('PABLO', 'C1', 'Front Office', ['irfan', 'recruiter']);

export const PANEL_RULES = rules;
