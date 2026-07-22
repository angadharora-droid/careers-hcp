# CPH Recruitment & Position Control Platform

A single recruitment system for Centre Point Hospitality (Centre Point Amravati first, built to extend to other units): **one shared backend + three frontends** that read and write the same data.

```
                    ┌───────────────────────┐
                    │   backend/            │
                    │   Express + MongoDB   │
                    │   REST API :5000      │
                    └──────────┬────────────┘
        ┌──────────────────────┼──────────────────────┐
┌───────▼────────┐   ┌─────────▼────────┐   ┌─────────▼─────────┐
│ career-panel/  │   │ hr-panel/        │   │ interview-panel/  │
│ public :5173   │   │ HR login :5174   │   │ interviewer :5175 │
└────────────────┘   └──────────────────┘   └───────────────────┘
```

| Folder | What it is | Who uses it |
|---|---|---|
| `backend/` | Node.js + Express + MongoDB (Mongoose) REST API, JWT auth, file uploads, seed data | everything below |
| `career-panel/` | Public careers site — browse open roles, apply | candidates (no login) |
| `hr-panel/` | Position Control Register (PCNs), applications pipeline, interviewer appointment, competency library, dashboards | HR (`hr_admin` login) |
| `interview-panel/` | Behavioural scoring of assigned candidates, panel comparison | interviewers (login, scoped to their assignments) |

All four are Vite/React/Tailwind or Node projects — `npm install` then `npm run dev`/`npm start` in each.

## Quick start

```bash
# 1. Backend (port 5000)
cd backend
npm install
npm start          # no MongoDB installed? it auto-falls back to an in-memory DB (data resets on restart)

# 2. In three more terminals:
cd career-panel    && npm install && npm run dev   # http://localhost:5173
cd hr-panel        && npm install && npm run dev   # http://localhost:5174
cd interview-panel && npm install && npm run dev   # http://localhost:5175
```

For **persistent data**, install MongoDB (or use Atlas) and set it in `backend/.env`:
```
MONGODB_URI=mongodb://127.0.0.1:27017/cph_recruitment
JWT_SECRET=some-long-random-string
```

To let HR **email offer letters** from the server, also add SMTP settings (optional — without them, offer-letter preview/print still works and the "Email" button falls back to the HR user's own mail client):
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=hr@centrepointhospitality.in
SMTP_PASS=app-password
SMTP_FROM="Centre Point HR <hr@centrepointhospitality.in>"
```
On first run against an empty database the server seeds the full Centre Point Amravati roster: **67 PCN seats across 26 designations**, the 13-grade corporate structure, the competency library (Attitude 60% core + per-department Skills 25% / Knowledge 15% profiles for all 12 departments, at associate and executive level, + generic placeholders as a fallback), and demo users. `npm run seed -- --reset` wipes and reseeds.

**Updating an already-populated database.** The seed stops the moment one position exists, so a deployed unit never picks up competency changes on restart — deliberately, since HR edits anchors through the Framework page and an automatic refresh each boot would overwrite that work. To push a change to the assessment library out to a live unit:

```bash
npm run sync -- --dry   # print the plan, write nothing
npm run sync            # apply
```

It upserts the library, drops competencies the library no longer defines (an orphan would push a scoring form past 100%), back-fills `competency_profile` on seats and on applications that have not been scored yet, and verifies that every profile in use still totals 100%. It is idempotent, and it leaves seats whose designation isn't in the roster alone — those are listed for HR to set by hand.

## Seeded logins

| Panel | Email | Password | Role |
|---|---|---|---|
| HR Panel | `hr@cph.in` | `hr@2026` | hr_admin |
| Interview Panel | `gm@cph.in` (General Manager) | `panel@2026` | interviewer |
| Interview Panel | `ops@cph.in` (Operations Manager) | `panel@2026` | interviewer |
| Interview Panel | `chef@cph.in` (Executive Chef) | `panel@2026` | interviewer |
| Interview Panel | `admin@cph.in` (Admin Head) | `panel@2026` | interviewer |
| Interview Panel | `fo@cph.in` (Front Office Executive) | `panel@2026` | interviewer |

Change these before any real use (HR Panel → Interviewers tab creates accounts).

## The flow, end to end

1. **HR** keeps the Position Control Register: every sanctioned seat is a PCN (`CPA-FO-C1-001`), auto-numbered server-side. Recruitment only happens against a seat that is Vacant / Under Recruitment.
2. **Candidate** browses open roles on the Career Panel (grouped by job code — "3 openings", never seat numbers), applies with CV upload, gets a `CPH-XXXXXX` reference ID for HR correspondence. First application flips the role's Vacant seats to Under Recruitment.
3. **HR** reviews the application, schedules the interview, and **appoints the panel** from registered interviewer accounts (2 members; 3-member committee for A-grades).
4. **Interviewers** log into the Interview Panel and see *only their assigned candidates*. Each scores independently on the behavioural framework (Attitude 60 / Skills 25 / Knowledge 15, five anchored levels per competency), with evidence notes and red flags.
5. **Panel comparison** shows per-panellist scores side by side; >15-point divergence is flagged "discuss, don't average"; any red flag routes the candidate to HR's Red Flags queue regardless of score.
6. **HR selects** the candidate — the server enforces the recruitment gate (seat open + enough panel scores), atomically fills the seat, and records the occupant. Rejection always requires a reason.
7. **Offer** — on selection HR captures the **date of joining** and **offered salary**, then generates a branded **offer letter** (preview / print / Save-as-PDF in the browser) and emails it to the candidate (server SMTP, or a fallback hand-off to HR's own mail client). Filtered tables (Applications, Register) can be **exported to CSV** for whatever the current filters show.

## Business rules enforced server-side (not just in the UI)

- Recruitment gate: `Selected` only when a seat under the job code is Vacant/Under Recruitment **and** the panel has scored (2 or 3 per grade; deliberate override possible with ≥1 score).
- Selection fills the seat atomically (single `findOneAndUpdate` claim — concurrent HR users can't double-fill); un-selecting releases it.
- Vacant → Under Recruitment auto-flip on first application.
- Rejection requires a reason, chosen from the five standard rejection reasons (job stability, attitude/professionalism, communication, culture/team fit, skills/knowledge).
- Any red flag → HR review queue regardless of numeric total.
- PCN format `UNIT-DEPT-GRADE-SERIAL` generated from atomic counters.
- 50-word cap on the candidate intro.
- Days-vacant / SLA-breach math recomputed server-side.
- Score totals computed server-side from the competency library — client math is never trusted.

## Docs

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — every endpoint with request/response shapes.
- [docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md) — shared stack and brand system for the three apps.
- `cph_position_control_suite.html`, `cph_interviewer_platform.html` — the original standalone artifacts this platform replaces (kept for reference).

## Design decisions (assumptions made where the spec left choices open)

- **Seat vs role**: candidates apply to a *job code* (role); a specific PCN seat is claimed at *selection* time, matching the original artifact's behaviour. Seat claims also match the applied designation, so roles can never cross-fill.
- **Valet sub-code**: in the original data, Valet and GSA–Front Office both sit in Front Office grade C1 and would share job code `CPA-FO-C1` (merging two different roles on the careers site). Valet seats are seeded under sub-code `CPA-VAL-C1` to keep job codes role-unique.
- **Auto-flip scope**: the first application flips *all* Vacant seats of that job code to Under Recruitment (recruitment activity has started on the role).
- **Panel Comparison** lives in *both* internal panels, reading the same `GET /applications/:id/scores` endpoint (HR sees every candidate; interviewers only their assigned ones).
- **DB**: MongoDB (per request) with Mongoose; "transaction" semantics for select-and-fill are achieved with an atomic conditional update + rollback, since standalone MongoDB has no multi-document transactions.
- **Job descriptions** are plain text with paragraph breaks (rendered nicely in the Career Panel); seeded with sensible defaults per role so the public site isn't empty.
- **Salary band** is published on the Career Panel (min–max); budgeted salary, PCN codes, occupants and panel data are never exposed publicly.
