import { Router } from 'express';
import Grade from '../models/Grade.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth); // read: any logged-in user (interviewers need panel sizes)

router.get('/', async (_req, res) => {
  const grades = await Grade.find({}).sort('order');
  res.json({ grades });
});

router.patch('/:code', requireRole('hr_admin'), async (req, res) => {
  const b = { ...req.body };
  delete b.code; delete b._id;
  const grade = await Grade.findOneAndUpdate({ code: req.params.code }, b, { new: true });
  if (!grade) return res.status(404).json({ error: 'Grade not found' });
  res.json({ grade });
});

export default router;
