import { Router } from 'express';
import Position, { POSITION_STATUSES } from '../models/Position.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { nextPCN, deptAbbrOf, jobCodeOf, daysVacant, slaBreached } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth, requireRole('hr_admin'));

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

// POST /api/positions — PCN auto-generated server-side (UNIT-DEPT-GRADE-SERIAL)
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

    const wasVacant = p.status === 'Vacant';
    Object.assign(p, b);
    if (b.status === 'Vacant' && !wasVacant) {
      p.vacant_since = new Date();
      p.occupant_name = '';
    }
    await p.save();
    res.json({ position: decorate(p) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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

export default router;
