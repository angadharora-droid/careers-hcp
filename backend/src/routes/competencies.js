import { Router } from 'express';
import Competency from '../models/Competency.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/competencies?profile=core|fo_assoc|fo_exec|generic
router.get('/', async (req, res) => {
  const filter = req.query.profile ? { profile: req.query.profile } : {};
  const competencies = await Competency.find(filter).sort({ profile: 1, order: 1 });
  res.json({ competencies });
});

// POST — HR adds a competency (e.g. a HOD's real trade content replacing a placeholder)
router.post('/', requireRole('hr_admin'), async (req, res) => {
  try {
    const c = await Competency.create(req.body);
    res.status(201).json({ competency: c });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH — this is where "HOD replaces the placeholder" actually happens
router.patch('/:id', requireRole('hr_admin'), async (req, res) => {
  try {
    const b = { ...req.body };
    delete b._id;
    const c = await Competency.findById(req.params.id);
    if (!c) return res.status(404).json({ error: 'Competency not found' });
    Object.assign(c, b);
    await c.save(); // runs the 5-anchor validation
    res.json({ competency: c });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('hr_admin'), async (req, res) => {
  const c = await Competency.findByIdAndDelete(req.params.id);
  if (!c) return res.status(404).json({ error: 'Competency not found' });
  res.json({ ok: true });
});

export default router;
