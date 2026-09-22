import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { isSsoApp, verifySsoToken } from '../lib/ssoClient.js';

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

// POST /api/auth/sso  { token, app } → { token, user } — central sign-on from the
// CPG portal. `app` is the calling panel's portal key (hr-recruitment or
// interview); the hand-off token is accepted only if the auth service verifies
// it for that app. The response matches /login, so each panel's own role gate
// still applies. No-op until AUTH_SERVICE_URL is set; /login is unchanged.
router.post('/sso', async (req, res, next) => {
  try {
    const { token, app } = req.body || {};
    if (!token || !app) return res.status(400).json({ error: 'token and app required' });
    if (!isSsoApp(String(app))) return res.status(400).json({ error: 'Unknown app' });

    const verified = await verifySsoToken(String(token), String(app));
    if (!verified) return res.status(401).json({ error: 'SSO sign-in failed' });

    // The link table stores this app's Mongo _id; anything else can't match.
    const user = mongoose.isValidObjectId(verified.localUserId)
      ? await User.findById(verified.localUserId)
      : null;
    if (!user) return res.status(404).json({ error: 'No account linked' });

    res.json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeJSON() }));

export default router;
