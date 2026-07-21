import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cph-dev-secret-change-in-production';

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), roles: user.roles }, JWT_SECRET, { expiresIn: '12h' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Passes when the user holds ANY of the listed roles — an account carrying both
// hr_admin and interviewer reaches both sets of routes.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.hasRole(...roles)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
