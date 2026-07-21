import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login  { email, password } → { token, user }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeJSON() }));

export default router;
