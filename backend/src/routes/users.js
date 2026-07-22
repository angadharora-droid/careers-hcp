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

// PATCH /api/users/:id — edit a registered account. Every field is optional; only
// what is sent is changed. `password` re-hashes the login, everything else is profile.
router.patch('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    const { name, email, password, role, roles, department, designation } = req.body || {};

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty' });
      user.name = String(name).trim();
    }
    if (email !== undefined) {
      if (!String(email).trim()) return res.status(400).json({ error: 'Email cannot be empty' });
      user.email = String(email).trim().toLowerCase();
    }
    if (department !== undefined) user.department = String(department).trim();
    if (designation !== undefined) user.designation = String(designation).trim();

    if (roles !== undefined || role !== undefined) {
      const wanted = [...new Set((Array.isArray(roles) && roles.length ? roles : [role]).filter((r) => ROLES.includes(r)))];
      if (!wanted.length) return res.status(400).json({ error: `Role must be one of: ${ROLES.join(', ')}` });
      // Two lockout guards. Dropping your own HR access logs you out of the panel you
      // are standing in; dropping the last one locks *everybody* out for good.
      const losingHr = user.roles.includes('hr_admin') && !wanted.includes('hr_admin');
      if (losingHr && String(user._id) === String(req.user._id)) {
        return res.status(400).json({ error: 'You cannot remove your own HR admin access' });
      }
      if (losingHr && (await User.countDocuments({ roles: 'hr_admin' })) <= 1) {
        return res.status(400).json({ error: 'This is the last HR admin account — grant HR admin to someone else first' });
      }
      user.roles = wanted;
    }

    if (password !== undefined && String(password) !== '') {
      if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      user.password_hash = await bcrypt.hash(String(password), 10);
    }

    await user.save();
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ error: err.code === 11000 ? 'Email already registered' : err.message });
  }
});

export default router;
