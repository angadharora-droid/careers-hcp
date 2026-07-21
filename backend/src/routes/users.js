import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User, { ROLES } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('hr_admin'));

// GET /api/users?role=interviewer — interviewer directory for panel appointment.
// Matches anyone HOLDING that role, so dual-role staff appear in both directories.
router.get('/', async (req, res) => {
  const filter = req.query.role ? { roles: req.query.role } : {};
  const users = await User.find(filter).sort('name');
  res.json({ users: users.map((u) => u.toSafeJSON()) });
});

// POST /api/users — create an interviewer, an HR admin, or someone who is both.
// Accepts `roles: ['hr_admin','interviewer']`, or a single `role` for older clients.
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, roles, department, designation } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const wanted = (Array.isArray(roles) && roles.length ? roles : [role])
      .filter((r) => ROLES.includes(r));
    const user = await User.create({
      name, email, department, designation,
      roles: wanted.length ? [...new Set(wanted)] : ['interviewer'],
      password_hash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ error: err.code === 11000 ? 'Email already registered' : err.message });
  }
});

export default router;
