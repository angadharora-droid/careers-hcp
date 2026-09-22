// Drop-in client for the central sign-on service (from
// Meeting Os/auth/integration/node/ssoClient.js), adapted for a backend that
// serves more than one portal app: SSO_APP_KEYS lists every app key this
// backend answers for (hr-recruitment for the HR panel, interview for the
// interview panel) and each verify names the app the token must be for.
// Set AUTH_SERVICE_URL, SSO_APP_KEYS, SSO_SHARED_SECRET to enable it.
import crypto from 'crypto';

const AUTH_SERVICE_URL = String(process.env.AUTH_SERVICE_URL || '').replace(/\/+$/, '');
export const SSO_APP_KEYS = String(process.env.SSO_APP_KEYS || process.env.SSO_APP_KEY || 'hr-recruitment,interview')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);
const SSO_SHARED_SECRET = process.env.SSO_SHARED_SECRET || '';

export function ssoEnabled() {
  return Boolean(AUTH_SERVICE_URL);
}

// True when `app` is one of the portal app keys this backend serves.
export function isSsoApp(app) {
  return SSO_APP_KEYS.includes(app);
}

// Exchanges a hand-off token (from the browser) for the local user it belongs to.
// Resolves to { localUserId, centralId, name, role } or null when the token is not valid for `app`.
export async function verifySsoToken(token, app) {
  if (!ssoEnabled() || !token || !isSsoApp(app)) return null;
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SSO-App': app },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || data.app !== app) return null;
    return { localUserId: data.localUserId, centralId: data.centralId, name: data.name, role: data.role };
  } catch (err) {
    console.error('SSO verify failed:', err.message);
    return null;
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Guards the user-directory endpoint the auth service calls when the admin matches accounts.
export function directoryGuard(req, res, next) {
  if (!SSO_SHARED_SECRET || !safeEqual(req.get('X-SSO-Secret') || '', SSO_SHARED_SECRET)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  return next();
}
