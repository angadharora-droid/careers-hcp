import { Router } from 'express';
import Position, { POSITION_STATUSES } from '../models/Position.js';
import Application from '../models/Application.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  nextPCN, deptAbbrOf, jobCodeOf, daysVacant, slaBreached, bandStanding, RECRUITABLE_STATUSES,
} from '../utils/helpers.js';

const router = Router();
router.use(requireAuth, requireRole('hr_admin'));

/* A selected candidate is committed to the seat from the day they are selected,
   but only occupies it from the day they join. No joining date on file yet reads
   as 'Joining date not set' rather than silently claiming either. */
function joiningStatus(dateOfJoining) {
  if (!dateOfJoining) return 'Joining date not set';
  const doj = new Date(dateOfJoining);
  if (Number.isNaN(doj.getTime())) return 'Joining date not set';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  doj.setHours(0, 0, 0, 0);
  return doj > today ? 'Awaiting joining' : 'Joined';
}

function decorate(p) {
  const o = p.toObject({ versionKey: false });
  o.id = o._id;
  o.days_vacant = daysVacant(p);
  o.sla_breached = slaBreached(p);
  return o;
}

// GET /api/positions?dept=&grade=&status=&q=
router.get('/', async (req, res) => {
  const { dept, grade, status, q } = req.query;
  const filter = {};
  if (dept) filter.department = dept;
  if (grade) filter.grade = grade;
  if (status) filter.status = status;
  if (q) filter.$or = [
    { pcn: { $regex: q, $options: 'i' } },
    { designation: { $regex: q, $options: 'i' } },
  ];
  const positions = await Position.find(filter).sort('pcn');
  res.json({ positions: positions.map(decorate) });
});

// GET /api/positions/occupants — every Filled seat grouped by the person holding
// it, each seat annotated with the Selected application that claims it (if any).
// A Filled seat with NO Selected application behind it is either a seat seeded as
// Filled for existing staff, or one stranded by the old double-select bug — the
// latter is why the register can show the same occupant on several rows.
router.get('/occupants', async (req, res) => {
  const filled = await Position.find({ status: 'Filled' }).sort('pcn');
  /* Everything the occupant view shows about the person in the seat. The seat
     knows only a name; the application behind it carries who they actually are,
     what they were hired at, and the approval that put them there. */
  const selected = await Application.find(
    { stage: 'Selected', position_id: { $ne: null } },
    'candidate_name reference_id position_id date_of_joining offered_salary applied_on '
    + 'email mobile qualification total_experience_years relevant_hotel_experience_years '
    + 'current_employer source approval offer_sent_at offer_sent_method documents notice_period'
  );
  const bySeat = new Map(selected.map((a) => [String(a.position_id), a]));

  const groups = new Map();
  for (const p of filled) {
    const name = String(p.occupant_name || '').trim();
    // Seats seeded Filled without a name each stand alone — they are not duplicates.
    const key = name ? name.toLowerCase() : `(unnamed) ${p.pcn}`;
    if (!groups.has(key)) groups.set(key, { name, seats: [] });
    const a = bySeat.get(String(p._id)) || null;
    groups.get(key).seats.push({
      id: p._id,
      pcn: p.pcn,
      job_code: p.job_code,
      designation: p.designation,
      department: p.department,
      grade: p.grade,
      salary_min: p.salary_min,
      salary_max: p.salary_max,
      days_to_fill: p.days_to_fill,
      filled_on: p.filled_on,
      application: a && {
        id: a._id,
        reference_id: a.reference_id,
        date_of_joining: a.date_of_joining,
        offered_salary: a.offered_salary,
        applied_on: a.applied_on,
        // How the hired salary sits against this seat's sanctioned band.
        band_standing: bandStanding(a.offered_salary, p.salary_min, p.salary_max),
        email: a.email,
        mobile: a.mobile,
        qualification: a.qualification,
        total_experience_years: a.total_experience_years,
        relevant_hotel_experience_years: a.relevant_hotel_experience_years,
        current_employer: a.current_employer,
        source: a.source,
        notice_period: a.notice_period,
        documents: (a.documents || []).length,
        offer_sent_at: a.offer_sent_at,
        offer_sent_method: a.offer_sent_method || '',
        employee_code: a.approval?.employee_code || '',
        recommended_by: a.approval?.recommended_by || '',
        salary_approved_by: a.approval?.salary_approved_by || '',
        approval_date: a.approval?.approval_date || '',
        offer_issued_date: a.approval?.offer_issued_date || '',
        /* Selected is not the same as on the payroll. Until the joining date
           arrives the seat is committed, not occupied — the register should say so. */
        joining_status: joiningStatus(a.date_of_joining),
      },
    });
  }

  const occupants = [...groups.values()]
    .map((g) => ({
      ...g,
      seat_count: g.seats.length,
      unlinked_count: g.seats.filter((s) => !s.application).length,
    }))
    .sort((a, b) =>
      b.seat_count - a.seat_count
      || (a.name ? 0 : 1) - (b.name ? 0 : 1) // unnamed seeded seats after named people
      || a.name.localeCompare(b.name));

  const allSeats = occupants.flatMap((g) => g.seats);
  const withApp = allSeats.filter((s) => s.application);
  res.json({
    occupants,
    totals: {
      filled_seats: filled.length,
      occupants: occupants.length,
      multi_seat_occupants: occupants.filter((g) => g.seat_count > 1).length,
      unlinked_seats: occupants.reduce((n, g) => n + g.unlinked_count, 0),
      // Hired through this system, split by whether they have actually started.
      selected_total: withApp.length,
      awaiting_joining: withApp.filter((s) => s.application.joining_status === 'Awaiting joining').length,
      joined: withApp.filter((s) => s.application.joining_status === 'Joined').length,
      over_band: withApp.filter((s) => s.application.band_standing === 'Over band').length,
    },
  });
});

// POST /api/positions — PCN auto-generated server-side (UNIT-DEPT-GRADE-SERIAL).
// The scheme is fixed: seats of different designations in the same department and
// grade share a job_code; the Career Panel lists roles by designation, not code.
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.designation || !b.department || !b.grade) {
      return res.status(400).json({ error: 'Designation, department and grade are required' });
    }
    const unitAbbr = 'CPA';
    const pcn = await nextPCN(unitAbbr, deptAbbrOf(b.department), b.grade);
    const position = await Position.create({
      ...b,
      designation: String(b.designation).trim(),
      pcn,
      job_code: jobCodeOf(pcn),
      status: b.status && POSITION_STATUSES.includes(b.status) ? b.status : 'Vacant',
      vacant_since: b.status === 'Filled' ? null : new Date(),
      occupant_name: b.status === 'Filled' ? (b.occupant_name || '') : '',
    });
    res.status(201).json({ position: decorate(position) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/positions/:id
router.patch('/:id', async (req, res) => {
  try {
    const p = await Position.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Position not found' });
    const b = { ...req.body };
    delete b.pcn; delete b.job_code; delete b._id; // identity fields are immutable

    /* Reopening a seat restarts its vacancy clock. This has to cover BOTH
       recruitable statuses: marking a leaver's seat 'Under Recruitment' through
       the edit dialog is the normal way a seat reopens, and only handling
       'Vacant' left vacant_since null — which silently cost the seat both its
       days-vacant count and its time-to-fill on the next hire. */
    const wasRecruitable = RECRUITABLE_STATUSES.includes(p.status);
    Object.assign(p, b);
    const isRecruitable = RECRUITABLE_STATUSES.includes(p.status);
    if (isRecruitable && !wasRecruitable) {
      p.vacant_since = new Date();
      p.occupant_name = '';
      // The occupancy is over, so its time-to-fill no longer describes this seat.
      p.filled_on = null;
      p.days_to_fill = null;
    } else if (isRecruitable && !p.vacant_since) {
      // A seat that lost its clock to the older behaviour — start it now rather
      // than leave it permanently unmeasurable.
      p.vacant_since = new Date();
    }
    await p.save();
    res.json({ position: decorate(p) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/positions/:id/hand-back — release a Filled seat that no Selected
// application is holding (a double-select leftover, or a separated employee).
// A seat held by a live selection is refused: move that application out of
// Selected instead, which releases the seat and keeps both records in step.
router.post('/:id/hand-back', async (req, res) => {
  const p = await Position.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Position not found' });
  if (p.status !== 'Filled') {
    return res.status(400).json({ error: 'Only a Filled seat can be handed back' });
  }
  const holder = await Application.findOne(
    { stage: 'Selected', position_id: p._id },
    'candidate_name reference_id'
  );
  if (holder) {
    return res.status(400).json({
      error: `Seat is held by a live selection (${holder.candidate_name}, ${holder.reference_id}). ` +
        'Move that application out of Selected instead — that releases the seat.',
    });
  }
  p.status = 'Under Recruitment';
  p.occupant_name = '';
  p.vacant_since = new Date();
  // The occupancy is over, so its time-to-fill no longer describes this seat.
  p.filled_on = null;
  p.days_to_fill = null;
  await p.save();
  res.json({ position: decorate(p) });
});

// POST /api/positions/:id/eliminate — cannot eliminate a filled seat
router.post('/:id/eliminate', async (req, res) => {
  const p = await Position.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Position not found' });
  if (p.occupant_name) {
    return res.status(400).json({ error: 'Cannot eliminate a filled position — separate the occupant first' });
  }
  p.status = 'Eliminated';
  await p.save();
  res.json({ position: decorate(p) });
});

// DELETE /api/positions/:id — hard-remove a seat created in error.
// Seats with history (occupant or linked applications) must use eliminate instead,
// so selection/offer records never point at a missing position.
router.delete('/:id', async (req, res) => {
  const p = await Position.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Position not found' });
  if (p.occupant_name) {
    return res.status(400).json({ error: 'Cannot delete a filled position — separate the occupant first' });
  }
  const linked = await Application.countDocuments({ position_id: p._id });
  if (linked > 0) {
    return res.status(400).json({ error: `Cannot delete — ${linked} application(s) reference this seat. Use Eliminate instead.` });
  }
  await p.deleteOne();
  res.json({ ok: true });
});

export default router;
