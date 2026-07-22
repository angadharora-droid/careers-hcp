/* End-to-end smoke test against a RUNNING backend (npm start first).
   Exercises the full recruitment flow + the server-side business rules. */
const API = process.env.API || 'http://localhost:5000/api';

let passed = 0, failed = 0;
function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

async function req(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, {
    method, headers,
    body: form ? form : body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

const formOf = (obj, { files = [] } = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.append(k, String(v));
  for (const name of files) {
    f.append('documents', new Blob(['%PDF-1.4 smoke-test document'], { type: 'application/pdf' }), name);
  }
  return f;
};

const omit = (obj, ...keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

console.log(`Smoke-testing ${API} …\n`);

// health + public listing
const health = await req('GET', '/health');
ok('health endpoint', health.status === 200 && health.json.ok);

const pub = await req('GET', '/public/positions');
ok('public roles grouped by job_code (26 roles)', pub.status === 200 && pub.json.roles.length === 26, `got ${pub.json?.roles?.length}`);
const foRole = pub.json.roles.find((r) => r.designation === 'Guest Service Associate — Front Office');
ok('FO associate role open with 3 openings', foRole && foRole.openings === 3);
ok('public payload hides PCN/budget/occupant', foRole && !('pcn' in foRole) && !('budgeted_salary' in foRole) && !('occupant_name' in foRole));
ok('public payload hides salary band', foRole && !('salary_min' in foRole) && !('salary_max' in foRole));

// Every field on the apply form is mandatory, so negative tests start from a
// complete payload and omit exactly one thing.
const CURRENT_EMPLOYMENT_FIELDS = ['current_designation', 'years_in_current_firm', 'current_salary'];
const applicantOf = (over = {}) => ({
  job_code: foRole.job_code, candidate_name: 'Priya Sharma', mobile: '9876543210',
  email: 'priya@example.com', age: 24, gender: 'Female', qualification: 'BHM',
  total_experience_years: 2, current_designation: 'Front Desk Associate',
  years_in_current_firm: 1.5, current_salary: 14000, expected_salary: 16000,
  willing_to_relocate: 'Yes', needs_accommodation: 'No', worked_at_cph_before: 'No', source: 'Walk-in',
  why_join: 'Guest service career',
  intro_note: 'Hospitality graduate with front desk internship experience.',
  ...over,
});

// public application — word-cap rule
const longIntro = Array(51).fill('word').join(' ');
const capped = await req('POST', '/public/applications', {
  form: formOf(applicantOf({ intro_note: longIntro }), { files: ['cv.pdf'] }),
});
ok('50-word intro cap enforced server-side', capped.status === 400);

// public application — mandatory fields
for (const field of [
  'candidate_name', 'mobile', 'email', 'age', 'gender', 'qualification',
  'total_experience_years', 'expected_salary', 'willing_to_relocate',
  'needs_accommodation', 'worked_at_cph_before', 'source', 'why_join', 'intro_note',
]) {
  const r = await req('POST', '/public/applications', {
    form: formOf(omit(applicantOf(), field), { files: ['cv.pdf'] }),
  });
  ok(`missing "${field}" rejected`, r.status === 400, `got ${r.status}`);
}
for (const field of CURRENT_EMPLOYMENT_FIELDS) {
  const r = await req('POST', '/public/applications', {
    form: formOf(omit(applicantOf(), field), { files: ['cv.pdf'] }),
  });
  ok(`missing "${field}" rejected for an experienced candidate`, r.status === 400, `got ${r.status}`);
}
const noDocs = await req('POST', '/public/applications', { form: formOf(applicantOf()) });
ok('application without documents rejected', noDocs.status === 400, `got ${noDocs.status}`);
const badDoc = await req('POST', '/public/applications', {
  form: formOf(applicantOf(), { files: ['cv.docx'] }),
});
ok('non-PDF document rejected', badDoc.status === 400 && /pdf/i.test(badDoc.json?.error || ''), JSON.stringify(badDoc.json));

// ...but a fresher has no current employer to describe
const fresher = await req('POST', '/public/applications', {
  form: formOf({
    ...omit(applicantOf(), ...CURRENT_EMPLOYMENT_FIELDS),
    total_experience_years: 0, candidate_name: 'Fresher Test', email: 'fresher@example.com',
  }, { files: ['cv.pdf'] }),
});
ok('fresher (0 years) exempt from current-employment fields', fresher.status === 201, JSON.stringify(fresher.json));

// real application
const applied = await req('POST', '/public/applications', {
  form: formOf(applicantOf(), { files: ['cv.pdf'] }),
});
ok('application accepted with reference id', applied.status === 201 && /^CPH-/.test(applied.json.reference_id), JSON.stringify(applied.json));

// auto-flip Vacant -> Under Recruitment
const hrLogin = await req('POST', '/auth/login', { body: { email: 'hr@cph.in', password: 'hr@2026' } });
ok('HR login', hrLogin.status === 200 && hrLogin.json.user.roles.includes('hr_admin'));
const hr = hrLogin.json.token;

// Parag, Rajkumar and the shared recruiter run recruitment AND sit on panels:
// one login has to open both panels.
const dual = await req('POST', '/auth/login', { body: { email: 'cso.nagpur@cpgh.in', password: 'panel@2026' } });
ok('dual-role login carries both roles',
  dual.status === 200 && dual.json.user.roles.includes('hr_admin') && dual.json.user.roles.includes('interviewer'),
  JSON.stringify(dual.json?.user?.roles));
const dualTok = dual.json.token;
ok('dual-role user reaches HR-only routes', (await req('GET', '/applications', { token: dualTok })).status === 200);
ok('dual-role user reaches interviewer-only routes', (await req('GET', '/interviewer/assignments', { token: dualTok })).status === 200);
const paragIsHr = await req('GET', '/users?role=hr_admin', { token: hr });
ok('HR directory lists the three panel-side HR people',
  ['cso.nagpur@cpgh.in', 'hr.units@cpgh.in', 'recruiter@cpgh.in']
    .every((e) => paragIsHr.json.users.some((u) => u.email === e)),
  JSON.stringify(paragIsHr.json?.users?.map((u) => u.email)));
// …and an interviewer-only account must still be refused HR routes
const plain = await req('POST', '/auth/login', { body: { email: 'arjun.arora@cpgh.in', password: 'panel@2026' } });
ok('interviewer-only account refused HR routes',
  (await req('GET', '/applications', { token: plain.json.token })).status === 403);

const foSeats = await req('GET', `/positions?q=${foRole.job_code}`, { token: hr });
const flipped = foSeats.json.positions.filter((p) => p.job_code === foRole.job_code);
ok('Vacant → Under Recruitment auto-flip on first application', flipped.every((p) => p.status === 'Under Recruitment'), JSON.stringify(flipped.map((p) => p.status)));

// wrong-role access checks
const noAuth = await req('GET', '/positions');
ok('positions require auth', noAuth.status === 401);

// find the application
const apps = await req('GET', '/applications?q=Priya', { token: hr });
const app = apps.json.applications[0];
ok('HR sees application with panel_size 2', app && app.panel_size === 2);
ok('uploaded document stored on application', app && app.documents.length === 1 && app.documents[0].original_name === 'cv.pdf', JSON.stringify(app?.documents));
ok('worked-at-CPH answer stored on application', app && app.worked_at_cph_before === 'No', `got ${app?.worked_at_cph_before}`);

// rejection requires reason
const rejNoReason = await req('PATCH', `/applications/${app.id}/stage`, { token: hr, body: { stage: 'Rejected' } });
ok('rejection without reason blocked', rejNoReason.status === 400);

// rejection reason must be one of the standard reasons
const rejBad = await req('PATCH', `/applications/${app.id}/stage`, { token: hr, body: { stage: 'Rejected', rejection_reason: 'Did not like the CV font' } });
ok('non-standard rejection reason blocked', rejBad.status === 400);
const rejStd = await req('PATCH', `/applications/${app.id}/stage`, { token: hr, body: { stage: 'Rejected', rejection_reason: 'Weak communication skills' } });
ok('standard rejection reason accepted', rejStd.status === 200 && rejStd.json.application.rejection_reason === 'Weak communication skills');
await req('PATCH', `/applications/${app.id}/stage`, { token: hr, body: { stage: 'Applied' } }); // restore for the rest of the flow

// selection gate: no scores yet
const selEarly = await req('PATCH', `/applications/${app.id}/stage`, { token: hr, body: { stage: 'Selected' } });
ok('selection blocked with 0/2 scores', selEarly.status === 400);

// the fixed panel from Interview_Panel.xlsx covers this role before HR touches it
const rulePreview = await req('GET', `/applications/${app.id}/panel-rule`, { token: hr });
ok('fixed panel rule found for CPA / C1 / Front Office',
  rulePreview.status === 200 && rulePreview.json.rule?.rounds?.length === 2,
  JSON.stringify(rulePreview.json?.rule));
ok('round 2 of a C1 interview is the shared HR recruiter',
  rulePreview.json.rule?.rounds?.[1]?.interviewer?.email === 'recruiter@cpgh.in',
  rulePreview.json.rule?.rounds?.[1]?.interviewer?.email);

// appoint panel — rounds, not simultaneous slots. Appointment is locked to the fixed
// panel, so the picks must come from the rule itself, not from the interviewer directory.
const users = await req('GET', '/users?role=interviewer', { token: hr });
const slotOf = (n) => rulePreview.json.rule.rounds.find((r) => r.round === n).interviewer;
const i1 = { id: slotOf(1)._id, email: slotOf(1).email };
const i2 = { id: slotOf(2)._id, email: slotOf(2).email };

// someone who holds the interviewer role but is not named on THIS job's panel
const eligibleIds = rulePreview.json.rule.rounds
  .flatMap((r) => [r.interviewer, ...(r.alternates || [])])
  .map((u) => String(u._id));
const notOnPanel = users.json.users.find((u) => !eligibleIds.includes(String(u.id)));
const offPanel = await req('POST', `/applications/${app.id}/assign-panel`, {
  token: hr,
  body: { assignments: [{ interviewer_user_id: notOnPanel.id, round: 1 }] },
});
ok('interviewer outside the fixed panel is rejected', offPanel.status === 400, `got ${offPanel.status}`);
ok('rejection names who is eligible instead',
  /not on the panel for this job/.test(offPanel.json?.error || ''), offPanel.json?.error);

const assign = await req('POST', `/applications/${app.id}/assign-panel`, {
  token: hr,
  body: { assignments: [
    { interviewer_user_id: i1.id, round: 1 },
    { interviewer_user_id: i2.id, round: 2 },
  ] },
});
ok('panel assigned (2 rounds)', assign.status === 200 && assign.json.application.panel_assignments.length === 2, assign.json?.error);
ok('assignments carry round numbers',
  assign.json.application.panel_assignments.map((a) => a.round).join(',') === '1,2');

// two people cannot share a round
const clash = await req('POST', `/applications/${app.id}/assign-panel`, {
  token: hr,
  body: { assignments: [{ interviewer_user_id: i1.id, round: 1 }, { interviewer_user_id: i2.id, round: 1 }] },
});
ok('two panellists in the same round rejected', clash.status === 400);

// schedule interview — HR's manual picks must survive the auto-assign
const sched = await req('PATCH', `/applications/${app.id}/stage`, { token: hr, body: { stage: 'Interview Scheduled', interview_date: '20 Jul 2026, 11:00 AM' } });
ok('stage → Interview Scheduled', sched.status === 200);
ok('auto-assign does not overwrite HR\'s manual panel',
  sched.json.application.panel_assignments.every((a) => a.auto_assigned === false));

// interviewer 1 scores
const int1 = await req('POST', '/auth/login', { body: { email: i1.email, password: 'panel@2026' } });
const t1 = int1.json.token;
const queue1 = await req('GET', '/interviewer/assignments', { token: t1 });
ok('interviewer sees only assigned candidate', queue1.json.assignments.length === 1 && queue1.json.assignments[0].candidate_name === 'Priya Sharma');

const detail = await req('GET', `/interviewer/applications/${app.id}`, { token: t1 });
// 4 core attitude + 3 skills (practical, incident/report, grooming) + 2 knowledge
ok('scoring form resolves FO associate competencies (9)', detail.json.competencies.length === 9, `got ${detail.json?.competencies?.length}`);
ok('competency weights sum to 100', detail.json.competencies.reduce((s, c) => s + c.weight, 0) === 100);
ok('round 1 is open for its interviewer', detail.json.panel.active_round === 1 && !detail.json.panel.locked_reason);

// round 2 is locked until round 1 is in
const int2early = await req('POST', '/auth/login', { body: { email: i2.email, password: 'panel@2026' } });
const early = await req('POST', `/interviewer/applications/${app.id}/score`, {
  token: int2early.json.token,
  body: { competency_selections: detail.json.competencies.map((c) => ({ key: c.key, level_index: 1 })) },
});
ok('panel 2 blocked while panel 1 is unscored', early.status === 400 && /opens once panel 1/.test(early.json?.error || ''), early.json?.error);

const allStrong = detail.json.competencies.map((c) => ({ key: c.key, level_index: 1 })); // Strong = 80%
const score1 = await req('POST', `/interviewer/applications/${app.id}/score`, {
  token: t1,
  body: { competency_selections: allStrong, evidence_notes: 'Handled mock check-in well.', strengths: 'Warm', concerns: '', red_flags: [] },
});
ok('score 1 submitted, server total = 80', score1.status === 201 && score1.json.score.total_score === 80, `got ${score1.json?.score?.total_score}`);

// an interviewer who holds no round on this candidate is locked out
const outsider = users.json.users.find((u) => u.id !== i1.id && u.id !== i2.id);
const int3 = await req('POST', '/auth/login', { body: { email: outsider.email, password: 'panel@2026' } });
ok('seeded panellist can log in', int3.status === 200 && !!int3.json.token, outsider.email);
const locked = await req('GET', `/interviewer/applications/${app.id}`, { token: int3.json.token });
ok('unassigned interviewer gets 403', locked.status === 403);

// selection still blocked at 1/2
const selHalf = await req('PATCH', `/applications/${app.id}/stage`, { token: hr, body: { stage: 'Selected' } });
ok('selection blocked with 1/2 scores', selHalf.status === 400);

// interviewer 2 scores with a red flag
const int2 = await req('POST', '/auth/login', { body: { email: i2.email, password: 'panel@2026' } });
const t2 = int2.json.token;
const detail2 = await req('GET', `/interviewer/applications/${app.id}`, { token: t2 });
const mixed = detail2.json.competencies.map((c) => ({ key: c.key, level_index: 2 })); // Acceptable = 60%
const score2 = await req('POST', `/interviewer/applications/${app.id}/score`, {
  token: t2,
  body: { competency_selections: mixed, evidence_notes: 'Hesitant on upsell.', strengths: '', concerns: 'Confidence', red_flags: ['Poor Communication'] },
});
ok('score 2 submitted, server total = 60', score2.status === 201 && score2.json.score.total_score === 60);

// panel comparison
const cmp = await req('GET', `/applications/${app.id}/scores`, { token: hr });
ok('panel comparison: avg 70, spread 20, diverged', cmp.json.summary.average === 70 && cmp.json.summary.spread === 20 && cmp.json.summary.diverged === true);
ok('red flag surfaces in summary', cmp.json.summary.any_red_flags === true);

// red-flag queue
const flaggedQ = await req('GET', '/applications?red_flag=true', { token: hr });
ok('red-flag HR queue contains candidate', flaggedQ.json.applications.some((a) => a.id === app.id));

// select — gate now open (2/2 scored)
const sel = await req('PATCH', `/applications/${app.id}/stage`, { token: hr, body: { stage: 'Selected' } });
ok('selection succeeds with full panel', sel.status === 200 && !!sel.json.filled_pcn, JSON.stringify(sel.json));

// seat flipped to Filled with occupant, transactionally
const seat = await req('GET', `/positions?status=Filled`, { token: hr });
const filledSeat = seat.json.positions.find((p) => p.pcn === sel.json.filled_pcn);
ok('seat Filled with occupant recorded', filledSeat && filledSeat.occupant_name === 'Priya Sharma');

// offer letter — gated until date of joining + salary are set
const offerEarly = await req('GET', `/applications/${app.id}/offer-letter`, { token: hr });
ok('offer letter blocked before terms set', offerEarly.status === 400);
const offerSet = await req('PATCH', `/applications/${app.id}/offer`, { token: hr, body: { date_of_joining: '2026-08-01', offered_salary: 16000 } });
ok('offer terms saved', offerSet.status === 200 && offerSet.json.application.offered_salary === 16000 && offerSet.json.application.date_of_joining === '2026-08-01');
const offerDoc = await req('GET', `/applications/${app.id}/offer-letter`, { token: hr });
ok('offer letter generates once terms set (HTML 200)', offerDoc.status === 200);
const offerMail = await req('POST', `/applications/${app.id}/send-offer`, { token: hr, body: {} });
ok('send-offer without SMTP returns email_configured:false', offerMail.status === 400 && offerMail.json.email_configured === false);

// PCN generation: new position gets next serial atomically
const newPos = await req('POST', '/positions', { token: hr, body: { designation: 'Guest Service Associate — Front Office', department: 'Front Office', grade: 'C1', job_family: 'Front Office', salary_min: 13000, salary_max: 18000, budgeted_salary: 18000 } });
ok('new PCN server-generated with next serial', newPos.status === 201 && /^CPA-FO-C1-\d{3}$/.test(newPos.json.position.pcn), newPos.json?.position?.pcn);

// dashboard
const dash = await req('GET', '/dashboard/summary', { token: hr });
ok('dashboard: SLA/aging computed', dash.status === 200 && dash.json.positions_total >= 67 && Array.isArray(dash.json.aging_vacancies));
ok('dashboard: red flag queue count = 1', dash.json.red_flag_queue_count === 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
