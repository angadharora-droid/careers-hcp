import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('hr_admin'));

// GET /api/users?role=interviewer — interviewer directory for panel appointment
router.get('/', async (req, res) => {
  const filter = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(filter).sort('name');
  res.json({ users: users.map((u) => u.toSafeJSON()) });
});

// POST /api/users — create interviewer (or another HR admin) account
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, department, designation } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = await User.create({
      name, email, department, designation,
      role: role === 'hr_admin' ? 'hr_admin' : 'interviewer',
      password_hash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ error: err.code === 11000 ? 'Email already registered' : err.message });
  }
});

export default router;
