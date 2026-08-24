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
Role = open roles grouped by **designation** (the advertised position name — never
seat-level PCNs). The PCN scheme is fixed as UNIT-DEPT-GRADE-SERIAL, so two roles in
the same department + grade can share a `job_code` (e.g. Admin Executive and Purchase
Executive both under `CPA-ADM-B1`); `job_code` is informational only. `slug` is the
role's stable public key/URL segment, derived from the designation:
```json
{
  "slug": "guest-service-associate-front-office",
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

### `GET /public/positions/:slug` → `{ role }` (404 if not open)
`job_code` is accepted as a legacy fallback; with shared codes it resolves to the first matching role.

### `POST /public/applications` — **multipart/form-data**
Fields: `designation`* (the role name — job_code cannot identify a role), `candidate_name`*, `mobile`*, `email`*, `age`, `gender`, `qualification`,
`total_experience_years`, `current_designation`, `years_in_current_firm`, `current_salary`,
`expected_salary`, `willing_to_relocate` (Yes/No), `needs_accommodation` (Yes/No),
`source` (Referral (employee) | Walk-in | Naukri / Portal | Instagram / Social | Newspaper | Consultant | Other),
`why_join`, `intro_note` (max 50 words — also validated server-side).
Files: `documents` (optional; up to 6; PDF only, 5 MB each). Bytes are stored in
MongoDB (`CandidateDocument`), so documents persist across redeploys exactly like
the application record.
→ `201 { reference_id: "CPH-XXXXXX", message }`
The reference ID identifies the application for HR correspondence and search; there is no
candidate-facing status lookup.

## HR (role `hr_admin`)

### Positions
- `GET /positions?dept=&grade=&status=&q=` → `{ positions: [Position] }`
  Position includes all schema fields plus `id`, `days_vacant` (null unless status=Vacant), `sla_breached`.
  Statuses: `Vacant | Filled | Under Recruitment | Frozen | On Hold | Contract | Outsourced | Eliminated`.
- `POST /positions` `{ designation*, department*, grade*, job_family, reports_to, cost_centre, salary_min, salary_max, replacement_sla_days, is_critical, is_revenue_generating, is_guest_facing, job_description, competency_profile, approver, remarks, status? }` → `201 { position }` — **PCN is generated server-side** (`CPA-DEPT-GRADE-###`).
- `PATCH /positions/:id` (any fields above; pcn/job_code immutable) → `{ position }`
- `GET /positions/occupants` → `{ occupants: [Occupant], totals }` — every Filled seat grouped by the person holding it.
  Each seat carries `{ id, pcn, job_code, designation, department, grade, salary_min, salary_max, days_to_fill, filled_on, application|null }`.
  `application` is the Selected application holding the seat, and carries the whole occupant record:
  `{ id, reference_id, date_of_joining, offered_salary, applied_on, band_standing, joining_status, email, mobile,
  qualification, total_experience_years, relevant_hotel_experience_years, current_employer, source, notice_period,
  documents, offer_sent_at, employee_code, recommended_by, salary_approved_by, approval_date, offer_issued_date }`.
  It is `null` for seats seeded Filled or stranded by a double-select.
  `joining_status` ∈ `Joined` · `Awaiting joining` · `Joining date not set` — Selected commits the seat, joining occupies it.
  `totals`: `{ filled_seats, occupants, multi_seat_occupants, unlinked_seats, selected_total, awaiting_joining, joined, over_band }`.
- `POST /positions/:id/hand-back` → `{ position }` — releases a Filled seat with no Selected application behind it (status → Under Recruitment, occupant cleared). 400 if the seat is not Filled or a live selection holds it.
- `POST /positions/:id/eliminate` → `{ position }` (400 if seat has an occupant)

### Salary band (there is no separate budget)

A position carries a sanctioned band, `salary_min` / `salary_max`. The old `budgeted_salary`
field is **gone** — it could drift out of step with the band it was supposed to sit inside,
and every question it answered is answered better by the band. `salary_max` must be at least
`salary_min`.

An actual offer is judged against that band as `band_standing`:

| Value | Meaning |
| --- | --- |
| `Within band` | at or between min and max |
| `Under band` | below `salary_min` |
| `Over band` | above `salary_max` |
| `null` | no band on file (both ends 0), or no offer yet — distinct from "inside the band" |

It appears on `GET /applications/:id` (with `salary_band: { min, max }`), on each occupant seat,
and on Section B of the Application Register.

### Time to fill

`Position.filled_on` and `Position.days_to_fill` are stamped when a selection claims the seat,
measured from `vacant_since` — which the same update clears, so the elapsed days are **recorded**
rather than recomputed. Releasing a seat clears both and restarts `vacant_since`, so a refill is
measured afresh. The dashboard averages them (`avg_days_to_fill`, with `filled_measured` giving
the number of seats the average stands on).

### Applications
- `GET /applications?stage=&q=&red_flag=true` → `{ applications: [Application] }`
- `GET /applications/:id` → `{ application }`
- `PATCH /applications/:id` (candidate fields only) → `{ application }`
  Also owns the Application Register's Section A annotations: `current_employer`,
  `relevant_hotel_experience_years`, `notice_period`, `remarks`. `stage`, `position_id`,
  `pcn` and `reference_id` are stripped — use the dedicated endpoints for those.
- `DELETE /applications/:id` → `{ ok: true }`

Application (HR view) includes candidate fields plus:
```json
{
  "id": "…", "reference_id": "CPH-ABC123", "job_code": "CPA-FO-C1", "pcn": "",
  "designation": "…", "department": "…", "grade": "C1", "stage": "Applied",
  "rejection_reason": "", "interview_date": "",
  "date_of_joining": "", "offered_salary": null, "offer_sent_at": null, "offer_sent_to": "",
  "applied_on": "…",
  "current_employer": "", "relevant_hotel_experience_years": null, "notice_period": "", "remarks": "",
  "comment_count": 0, "salary_band": { "min": 22000, "max": 28000 }, "band_standing": "Within band",
  "move_history": [{ "from_job_code", "from_designation", "from_stage", "moved_by_name", "note", "moved_at" }],
  "approval": { "recommended_by": "", "salary_approved_by": "", "approval_date": "", "offer_issued_date": "", "employee_code": "", "closed_by": "" },
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
- `Rejected` requires `rejection_reason`, which must be one of the standard reasons: `Frequent job changes / no stability`, `Negative attitude or poor professionalism`, `Weak communication skills`, `Not suitable for hotel culture / team fit`, `Lack of required skills or knowledge`, `Over budget` — or a free-text reason in the form `Other: <text>` (non-empty text, ≤300 chars total). Any other value is a 400.
- `Interview Scheduled`: also writes the standing interview panel onto the application (see *Interview rounds*).
- `Selected`: requires every round scored (`rounds`) — override with `allow_partial_panel:true` only if ≥1 score — AND a seat of that role (matched on job_code **and** designation, since a job_code can be shared by two roles) in Vacant/Under Recruitment. Atomically fills the seat (status→Filled, occupant recorded). Response also has `filled_pcn`. Optional `date_of_joining` (ISO `YYYY-MM-DD`) and `offered_salary` (monthly, number) are stored as the offer terms.
- Moving a Selected candidate to another stage releases their seat back to Under Recruitment.

### Offer letter (HR)
- `PATCH /applications/:id/offer` — Body `{ date_of_joining?, offered_salary? }`. Sets/adjusts offer terms; only valid while the candidate is `Selected`. → `{ application }`
- `GET /applications/:id/offer-letter` — returns a self-contained, printable **HTML** offer letter (not JSON). 400 until the candidate is Selected **and** both `date_of_joining` and `offered_salary` are set.
- `POST /applications/:id/send-offer` — Body `{ to? }` (defaults to the candidate's email). Emails the letter via server SMTP; on success records `offer_sent_at`/`offer_sent_to` and returns `{ application, sent_to }`. If SMTP is unconfigured, returns 400 with `{ error, email_configured: false }` so the client can fall back to a `mailto:` hand-off. Requires the same Selected + offer-terms gate as the letter.

SMTP is configured with `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_SECURE` (`true`/`false`), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `backend/.env`. Without them, letter preview/print still works; only server-side emailing is disabled.

### Comments — `\*/applications/:id/comments` (HR **and** the candidate's panellists)

One shared thread per application. HR and the interviewers appointed to that candidate both
post and both read; anyone else gets a 404. Comments are not scores — nothing here feeds the
recommendation.

- `GET /applications/:id/comments` → `{ comments: [{ id, author: { id, name, role, designation }, body, created_at }] }`, oldest first.
- `POST /applications/:id/comments` `{ body }` → `201 { comment }`. Body is required and ≤2000 chars. `author.role` is the hat the poster was wearing (`hr_admin` for a dual-role user posting from the HR panel).
- `DELETE /applications/:id/comments/:commentId` → `{ ok: true }`. The author can delete their own; HR can delete any.

`comment_count` rides along on every Application payload.

### Timeline — `GET /applications/:id/timeline` (HR **and** the candidate's panellists)

→ `{ timeline: [Item], current: { stage, rounds, rounds_scored, panel_appointed, awaiting } }`

Three sources are merged so nothing has to be trusted to stay in step with anything else:

| Source | Contributes |
| --- | --- |
| the application itself | the `applied` entry, which always exists |
| `PanelScore.submitted_at` | one `score` entry per round, as actually submitted |
| `ApplicationEvent` | `stage` · `panel` · `offer` · `approval` · `move` · `document` — the HR actions nothing else records |

Each item is `{ type, summary, detail, from, to, actor_name, actor_role, at }`, sorted oldest
first. `current.awaiting` names the open end (`"Round 2 of 3"`) or is `null`. Applications that
predate the event log still show a real timeline from the first two sources. Event writes are
fire-and-forget: a timeline entry never fails the action it describes.

### Move to another role — `POST /applications/:id/move` (HR)

Body: `{ job_code, designation, note? }` → `{ application, moved_to: { job_code, designation, grade } }`

The candidate applied to the wrong post, or reads better elsewhere. Server-enforced:

- **Refused once any round is scored** — those scores were made on the old role's scorecard, and another grade or department runs a different one. Reject and re-apply instead.
- **Refused for a Selected candidate** — move them out of Selected first, which releases their seat.
- The target must have a seat in Vacant / Under Recruitment.

On success the whole role snapshot (`job_code`, `designation`, `department`, `grade`, `job_family`,
`competency_profile`, `unit`) is taken from the target seat, any panel appointed for the old role
is dropped, and the application returns to `Applied` with its interview date and rejection cleared.
`reference_id` is **kept** (control point 1) and the old role is appended to `move_history`.

### Application Register (HR)

The recruitment control format, kept **separately for each vacant post** (`job_code` +
`designation`). Section A tracks every applicant, Section B records the selection and its
approval chain, Section C lists the mandatory control points. Everything except HR's own
annotations is compiled from positions, applications, panel assignments and panel scores,
so the register cannot drift from the pipeline.

- `GET /register/posts` → `{ posts: [Post] }` — the picker: every post with a sanctioned seat or an application behind it.
```json
{ "key": "CPA-FO-C1||Front Office Executive", "job_code": "CPA-FO-C1", "designation": "…",
  "department": "…", "grade": "C1", "unit": "…", "seats_total": 3, "open_vacancies": 2,
  "vacancies": 2, "applications": 5, "selected": 1, "pending": 2, "is_closed": false,
  "date_opened": "2026-08-01", "date_closed": null }
```
`vacancies` = seats still open **plus** seats this drive filled, so the count does not fall to
zero the moment the post is filled. `date_opened` is the earliest a seat went vacant;
`date_closed` stays `null` while any seat is recruitable, then becomes the moment the last
seat was taken.

- `GET /register?job_code=&designation=` → `{ header, rows, selection, control_points }`
  `job_code` is required (400 without it); `designation` narrows to one post where a job code
  is shared by two roles. 404 when no seat or application matches.

`rows` (Section A) carry the sample format's columns, with three **derived** ones that
satisfy control point 3 — they follow the pipeline and are not separately editable:

| Field | Derivation |
| --- | --- |
| `screening` | `Shortlisted` once a panel is appointed or an interview date is set; `Not shortlisted` if rejected before that; else `On hold` / `Pending` |
| `interview_status` | `N.A.` with no panel · `Round N scheduled` · `Did not attend` (rejected/parked with nothing scored) · `Round N cleared` · `Both/All rounds cleared` |
| `final_decision` | `Selected` · `Rejected` · `On hold` · `Final pending` (all rounds scored, HR yet to call it) · `Pending` |
| `register_flag` | Control point 7 — `Talent Pool` (arrived after closure) · `Post Closed` (undecided when the last seat went) · `""` |

Rows also carry `sr`, `application_id` (the `reference_id`), `date` (`dd-mm-yy`), the candidate
fields, `rounds`/`rounds_scored`/`panel_average`/`any_red_flags`, `interviewers` and `pcn`.

`selection` (Section B) holds one record per Selected candidate. `candidate_selected`,
`application_id`, `recommended_designation`, `recommended_salary` (the offered salary),
`interviewed_by`/`interviewer_names` and `expected_joining_date` are read off the application;
the six authority fields are stored and written through the endpoint below.

- `PATCH /applications/:id/approval` → `{ application }`
  Body: `{ recommended_by?, salary_approved_by?, approval_date?, offer_issued_date?, employee_code?, closed_by? }`.
  Dates are ISO `YYYY-MM-DD`. Only valid while the candidate is `Selected`. Server-enforced:
  - **Control point 5** — `offer_issued_date` requires `salary_approved_by`, `approval_date` and a set `offered_salary`, and cannot predate `approval_date`.
  - **Control point 6** — `employee_code` requires `offer_issued_date`.

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
  "band_min_total": 980000, "band_max_total": 1234000,
  "avg_days_to_fill": 34, "filled_measured": 12,
  "avg_days_vacant": 20, "sla_breached_count": 9,
  "aging_vacancies": [{ "pcn", "job_code", "designation", "department", "grade", "is_critical", "days_vacant", "replacement_sla_days", "sla_breached" }],
  "departments": [{ "department", "total", "filled", "under_recruitment", "vacant", "frozen_or_hold", "band_min", "band_max" }],
  "applications_total": 0, "pipeline": { "Applied": 0, … }, "red_flag_queue_count": 0
}
```

### Grades (read: any authed user; write: HR)
- `GET /grades` → `{ grades: [{ code, meaning, panel_size, present_at_cpa, order }] }`
- `PATCH /grades/:code` → `{ grade }`

### Competency library (read: any authed user; write: HR)
Profiles: `core` (Attitude 60%, all roles) · `<dept>_assoc` / `<dept>_exec` (Skills 25% + Knowledge 15%) · `generic` (placeholder skills/knowledge, fallback only).

`dept` ∈ `fo` `hk` `fb` `kit` `eng` `sec` `val` `str` `kst` `adm` `ops` `lead`. Content is transcribed from `hotel_assessment_criteria.docx`; `_exec` applies from grade B1 up (it carries that document's crisis-management and manpower/budget questions in place of `hosaware`), `_assoc` at B2 and below. `assoc`-only: `val` `str` `kst`. `exec`-only: `adm` `ops` `lead`.

Every profile is **3 skills + 2 knowledge**: skills `practical 10 + problem 10 + groom 5` = 25 · knowledge `deptknow 10 + hosaware 5` (assoc) or `deptknow 10 + execmgmt 5` (exec) = 15. With the 4-competency `core` block that is 9 competencies and 100% on every scoring form.

`problem` covers Section B's first two bullets together — handle the scenario, then write it up — because they are one event. `execmgmt` likewise scores the document's two `(Executive)` questions as one.
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
Served from MongoDB (`CandidateDocument`); the local `uploads/` folder is checked only
as a legacy fallback for files uploaded before database storage. A file found in
neither returns a 404 whose `error` explains the document was lost to a redeploy and
should be re-requested from the candidate.

`POST /applications/:id/documents` (hr_admin) — **multipart/form-data**, files under
`documents` (PDF only, 5 MB each, max 6 per application). Attaches documents HR
received directly (e.g. a re-sent CV) → `{ application }`.

## Scoring model (identical to the artifacts)
- Weights: Attitude 60 (Guest 20, Culture 15, Comm 15, Team 10) · Skills 25 · Knowledge 15.
- 5 levels × pct: Exceptional 1.0 · Strong 0.8 · Acceptable 0.6 · Below Expectations 0.4 · Not Suitable 0.2. Competency points = weight × pct.
- Bands: ≥85 Strongly Recommend · 70–84 Recommend · 55–69 Hold · <55 Do Not Recommend.
- Red flags list: Poor Grooming, Dishonesty, Poor Communication, Negative Attitude, Frequent Job Changes, Cultural Misfit.
- Rounds: 2 for grades below A-level; 3 for A1–A3 (from `grades.panel_size`). Run in order; the recommendation is the average across all rounds.
