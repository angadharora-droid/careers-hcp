# CPH Recruitment Platform — API Contract

Base URL: `http://localhost:5000/api` (frontends read `VITE_API_URL`, defaulting to this).
All request/response bodies are JSON unless noted. Errors are always `{ "error": "message" }` with a 4xx/5xx status.

## Auth

Internal panels authenticate with `Authorization: Bearer <token>`.

| Endpoint | Body | Response |
|---|---|---|
| `POST /auth/login` | `{ email, password }` | `{ token, user: { id, name, email, role, roles, department, designation } }` |
| `GET /auth/me` | — | `{ user }` |

Roles: `hr_admin`, `interviewer`. **An account can hold both** — check membership of
`roles`, not equality against `role`. `role` is the primary role (`roles[0]`), kept for
display and older clients. A route admits anyone holding *any* of its required roles.

Seeded logins — panellists come from `Interview_Panel.xlsx` via `seed/panelData.js`
(28 accounts, password `panel@2026`, override with `SEED_PANEL_PASSWORD`):
- HR only: `hr@cph.in` / `hr@2026`
- **HR + interviewer** (run recruitment *and* sit on panels): `cso.nagpur@cpgh.in` (Parag),
  `hr.units@cpgh.in` (Rajkumar), `recruiter@cpgh.in` (shared by all 3 recruiters)
- Interviewer only: the remaining 25, e.g. `arjun.arora@cpgh.in`, `opsmanager.cpa@cpgh.in`

Accounts written before multi-role are migrated automatically on boot (`roles: [role]`).

## Public (Career Panel — NO auth)

### `GET /public/positions` → `{ roles: [Role] }`
Role = open roles grouped by job_code (never seat-level PCNs):
```json
{
  "job_code": "CPA-FO-C1", "designation": "Guest Service Associate — Front Office",
  "department": "Front Office", "job_family": "Front Office",
  "grade_label": "Associate", "unit": "Centre Point Amravati",
  "location": "Amravati, Maharashtra",
  "salary_min": 13000, "salary_max": 18000,
  "reports_to": "Front Office Executive",
  "job_description": "About the role\n…(plain text, blank-line paragraphs, • bullets)",
  "openings": 3
}
```

### `GET /public/positions/:job_code` → `{ role }` (404 if not open)

### `POST /public/applications` — **multipart/form-data**
Fields: `job_code`*, `candidate_name`*, `mobile`*, `email`*, `age`, `gender`, `qualification`,
`total_experience_years`, `current_designation`, `years_in_current_firm`, `current_salary`,
`expected_salary`, `willing_to_relocate` (Yes/No), `needs_accommodation` (Yes/No),
`source` (Referral (employee) | Walk-in | Naukri / Portal | Instagram / Social | Newspaper | Consultant | Other),
`why_join`, `intro_note` (max 50 words — also validated server-side).
Files: `documents` (up to 6; pdf/doc/docx/jpg/png, 5 MB each).
→ `201 { reference_id: "CPH-XXXXXX", message }`
The reference ID identifies the application for HR correspondence and search; there is no
candidate-facing status lookup.

## HR (role `hr_admin`)

### Positions
- `GET /positions?dept=&grade=&status=&q=` → `{ positions: [Position] }`
  Position includes all schema fields plus `id`, `days_vacant` (null unless status=Vacant), `sla_breached`.
  Statuses: `Vacant | Filled | Under Recruitment | Frozen | On Hold | Contract | Outsourced | Eliminated`.
- `POST /positions` `{ designation*, department*, grade*, job_family, reports_to, cost_centre, salary_min, salary_max, budgeted_salary, replacement_sla_days, is_critical, is_revenue_generating, is_guest_facing, job_description, competency_profile, approver, remarks, status? }` → `201 { position }` — **PCN is generated server-side** (`CPA-DEPT-GRADE-###`).
- `PATCH /positions/:id` (any fields above; pcn/job_code immutable) → `{ position }`
- `POST /positions/:id/eliminate` → `{ position }` (400 if seat has an occupant)

### Applications
- `GET /applications?stage=&q=&red_flag=true` → `{ applications: [Application] }`
- `GET /applications/:id` → `{ application }`
- `PATCH /applications/:id` (candidate fields only) → `{ application }`
- `DELETE /applications/:id` → `{ ok: true }`

Application (HR view) includes candidate fields plus:
```json
{
  "id": "…", "reference_id": "CPH-ABC123", "job_code": "CPA-FO-C1", "pcn": "",
  "designation": "…", "department": "…", "grade": "C1", "stage": "Applied",
  "rejection_reason": "", "interview_date": "",
  "date_of_joining": "", "offered_salary": null, "offer_sent_at": null, "offer_sent_to": "",
  "applied_on": "…",
  "documents": [{ "filename": "…", "original_name": "cv.pdf" }],
  "rounds": 2,
  "panel_size": 2,
  "score_summary": { "count": 1, "needed": 2, "average": 78, "spread": 0, "diverged": false, "any_red_flags": false, "recommendation": "Recommend", "rounds_completed": [1], "next_round": 2 },
  "panel_assignments": [{ "id": "…", "round": 1, "interviewer": { "id", "name", "department", "designation" }, "panel_role": "Round 1", "status": "Pending|Scored", "auto_assigned": true, "assigned_at": "…" }]
}
```
`panel_size` is a legacy alias of `rounds` and carries the same number.

### Pipeline list — `GET /applications`
Query: `stage`, `q` (candidate name / job code / reference), `department`, `job_code`, `grade`, `red_flag=true`.
All compose; omitting a param leaves that dimension unfiltered. → `{ applications: [Application] }`

### Stage change — `PATCH /applications/:id/stage`
Body: `{ stage, rejection_reason?, interview_date?, date_of_joining?, offered_salary?, position_id?, allow_partial_panel? }`
Server-enforced rules (surface the returned `error` to the user):
- `Rejected` requires `rejection_reason`, which must be one of the standard reasons: `Frequent job changes / no stability`, `Negative attitude or poor professionalism`, `Weak communication skills`, `Not suitable for hotel culture / team fit`, `Lack of required skills or knowledge`.
- `Interview Scheduled`: also writes the standing interview panel onto the application (see *Interview rounds*).
- `Selected`: requires every round scored (`rounds`) — override with `allow_partial_panel:true` only if ≥1 score — AND a seat with that job_code in Vacant/Under Recruitment. Atomically fills the seat (status→Filled, occupant recorded). Response also has `filled_pcn`. Optional `date_of_joining` (ISO `YYYY-MM-DD`) and `offered_salary` (monthly, number) are stored as the offer terms.
- Moving a Selected candidate to another stage releases their seat back to Under Recruitment.

### Offer letter (HR)
- `PATCH /applications/:id/offer` — Body `{ date_of_joining?, offered_salary? }`. Sets/adjusts offer terms; only valid while the candidate is `Selected`. → `{ application }`
- `GET /applications/:id/offer-letter` — returns a self-contained, printable **HTML** offer letter (not JSON). 400 until the candidate is Selected **and** both `date_of_joining` and `offered_salary` are set.
- `POST /applications/:id/send-offer` — Body `{ to? }` (defaults to the candidate's email). Emails the letter via server SMTP; on success records `offer_sent_at`/`offer_sent_to` and returns `{ application, sent_to }`. If SMTP is unconfigured, returns 400 with `{ error, email_configured: false }` so the client can fall back to a `mailto:` hand-off. Requires the same Selected + offer-terms gate as the letter.

SMTP is configured with `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_SECURE` (`true`/`false`), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `backend/.env`. Without them, letter preview/print still works; only server-side emailing is disabled.

### Interview rounds

An interview is a sequence of **rounds**, not a committee sitting together. Grade
decides how many (`grades.panel_size`: 3 for A-grades, 2 for B/C). Round N stays locked
for its interviewer until round N-1 has been scored, and the final recommendation is
the average across all rounds.

One interviewer may hold **several rounds** on the same candidate — the standing panel
puts the same senior person in round 1 and round 3 of every A-grade interview.

The standing panel comes from `Interview_Panel.xlsx` and is keyed on
unit + grade + department. Moving an application to `Interview Scheduled` writes it
automatically; rounds HR has already set by hand, and rounds already scored, are left alone.

- `GET /applications/:id/panel-rule` — preview the standing panel without writing it.
  → `{ rule: { unit_code, grade, department, dept_code, rounds: [{ round, interviewer, alternates }] } | null }`.
  `alternates` holds the other names where the sheet offers a choice ("ARJUN SIR/ANGADH SIR").
- `POST /applications/:id/apply-panel-rule` — Body `{ replace?: false }`. (Re)applies it.
  `replace:true` overwrites unscored manual picks. 404 when no rule covers this
  unit/grade/department. → `{ application, rounds_applied }`

### Panel appointment — `POST /applications/:id/assign-panel`
Body: `{ assignments: [{ interviewer_user_id, round }] }` — `round` may be omitted, in which
case it is taken from array order. 1..`rounds` entries, each round distinct; two people
cannot share a round, but one person may hold several. A round that has already been
scored can be neither removed nor reassigned. → `{ application }`

### Shared scores read — `GET /applications/:id/scores` (hr_admin OR an assigned interviewer)
```json
{
  "candidate_name": "…", "designation": "…", "job_code": "…", "grade": "C1", "stage": "…",
  "rounds": 2,
  "summary": { "count": 2, "needed": 2, "average": 81, "spread": 18, "diverged": true, "any_red_flags": false, "recommendation": "Recommend", "rounds_completed": [1, 2], "next_round": null },
  "scores": [{ "round": 1, "panelist_name": "…", "panel_role": "…", "total_score": 90, "red_flags": [], "evidence_notes": "…", "strengths": "…", "concerns": "…", "competency_breakdown": [{ "competency_key", "name", "section", "weight", "level_index", "level_label", "points" }], "submitted_at": "…" }]
}
```
`diverged` = spread > 15 points → "discuss, don't average". Any red flag → HR review regardless of score.

### Dashboard — `GET /dashboard/summary`
```json
{
  "positions_total": 67, "by_status": { "Vacant": 67, "Filled": 0, … },
  "budget_total": 1234000, "avg_days_vacant": 20, "sla_breached_count": 9,
  "aging_vacancies": [{ "pcn", "job_code", "designation", "department", "grade", "is_critical", "days_vacant", "replacement_sla_days", "sla_breached" }],
  "departments": [{ "department", "total", "filled", "under_recruitment", "vacant", "frozen_or_hold", "budgeted_salary" }],
  "applications_total": 0, "pipeline": { "Applied": 0, … }, "red_flag_queue_count": 0
}
```

### Grades (read: any authed user; write: HR)
- `GET /grades` → `{ grades: [{ code, meaning, panel_size, present_at_cpa, order }] }`
- `PATCH /grades/:code` → `{ grade }`

### Competency library (read: any authed user; write: HR)
Profiles: `core` (Attitude 60%, all roles) · `fo_assoc` · `fo_exec` · `generic` (placeholder skills/knowledge).
- `GET /competencies?profile=` → `{ competencies: [{ _id, key, name, section: "att|skill|know", weight, profile, anchors: [5 strings], is_placeholder, order }] }`
- `POST /competencies` / `PATCH /competencies/:id` / `DELETE /competencies/:id` (exactly 5 anchors enforced)

### Users
- `GET /users?role=interviewer` → `{ users }` — matches anyone *holding* that role, so dual-role staff appear in both the interviewer and the HR directory.
- `POST /users` `{ name, email, password, roles: ["hr_admin","interviewer"], department, designation }` → `201 { user }`. A single `role` string is still accepted; omitting both defaults to `interviewer`.

## Interviewer (role `interviewer`)

- `GET /interviewer/assignments` → `{ assignments: [{ id, application_id, round, panel_role, status: "Pending|Scored", unlocked, assigned_at, candidate_name, designation, job_code, grade, department, stage, interview_date }] }` — only rows naming this interviewer. One row per round, so the same candidate appears twice for someone holding two rounds. `unlocked:false` means an earlier round is still outstanding.
- `GET /interviewer/applications/:id?round=` →
```json
{
  "application": { "id", "candidate_name", "designation", "job_code", "grade", "department", "job_family", "stage", "interview_date", "age", "gender", "qualification", "total_experience_years", "current_designation", "years_in_current_firm", "intro_note", "why_join", "documents" },
  "panel": { "rounds": 2, "size": 2, "committee": false, "my_rounds": [1], "my_role": "Round 1", "active_round": 1, "locked_reason": null, "rounds_completed": [] },
  "levels": [{ "label": "Exceptional", "pct": 1 }, { "label": "Strong", "pct": 0.8 }, { "label": "Acceptable", "pct": 0.6 }, { "label": "Below Expectations", "pct": 0.4 }, { "label": "Not Suitable", "pct": 0.2 }],
  "competencies": [{ "key", "name", "section": "att|skill|know", "weight", "anchors": [5], "is_placeholder" }],
  "my_score": null
}
```
  403 if this interviewer holds no round on the candidate. Without `?round=`, the payload
  targets their earliest unscored round. `active_round` is null and `locked_reason` explains
  why when an earlier round is still open. `my_score` (same shape as a score) enables edit-and-resubmit.
- `POST /interviewer/applications/:id/score`
  `{ competency_selections: [{ key, level_index 0-4 }], evidence_notes, strengths, concerns, red_flags: [string], round? }`
  Every competency required; points computed server-side; only allowed while stage = `Interview Scheduled`.
  400 with `locked_reason` if an earlier round has not been scored yet.
  → `201 { score: { round, total_score, recommendation, red_flags }, next_round }` (resubmit replaces that round's score)
- `GET /applications/:id/scores` — panel comparison (shared with HR, see above).

## Files
`GET /files/:filename` with Bearer token → uploaded document (HR/interviewer only).

## Scoring model (identical to the artifacts)
- Weights: Attitude 60 (Guest 20, Culture 15, Comm 15, Team 10) · Skills 25 · Knowledge 15.
- 5 levels × pct: Exceptional 1.0 · Strong 0.8 · Acceptable 0.6 · Below Expectations 0.4 · Not Suitable 0.2. Competency points = weight × pct.
- Bands: ≥85 Strongly Recommend · 70–84 Recommend · 55–69 Hold · <55 Do Not Recommend.
- Red flags list: Poor Grooming, Dishonesty, Poor Communication, Negative Attitude, Frequent Job Changes, Cultural Misfit.
- Rounds: 2 for grades below A-level; 3 for A1–A3 (from `grades.panel_size`). Run in order; the recommendation is the average across all rounds.
