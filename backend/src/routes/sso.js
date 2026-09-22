import { Router } from 'express';
import User from '../models/User.js';
import { directoryGuard } from '../lib/ssoClient.js';

const router = Router();

// GET /api/sso/users[?role=hr_admin|interviewer] — user directory for the central
// sign-on admin screen, so accounts can be matched to portal logins without
// pasting a CSV. One backend serves both panels, so the auth service can point
// each app key at this route with the matching role filter. Read-only and
// reachable only with the shared secret; the projection names the public fields
// and never password_hash.
router.get('/users', directoryGuard, async (req, res, next) => {
  try {
    const filter = req.query.role ? { roles: String(req.query.role) } : {};
    const users = await User.find(filter, 'name email roles').sort('name').lean();
    res.json(
      users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: (u.roles || []).join(', ') }))
    );
  } catch (err) {
    next(err);
  }
});

export default router;
