import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearSession, getToken, setUnauthorizedHandler, storedUser, storeSession } from '../lib/api';
import { SSO_APP_KEY, resolveSsoToken, ssoEnabled, ssoLogout } from '../lib/sso';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getToken());
  const [user, setUser] = useState(() => storedUser());
  // True while we ask the portal whether this visitor is already signed in —
  // only when there is no stored token and central sign-on is configured.
  const [ssoChecking, setSsoChecking] = useState(() => !getToken() && ssoEnabled());

  const logout = useCallback(() => {
    ssoLogout(); // end the portal session too, or the next load signs back in
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  // Central sign-on: with no stored token, the portal cookie may still identify
  // this visitor. The hand-off token is exchanged for the same { token, user } a
  // password login returns and stored the same way; the hr_admin gate applies
  // exactly as in login(). Anything else falls through to the login page.
  useEffect(() => {
    if (!ssoChecking) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const ssoToken = await resolveSsoToken();
        if (!ssoToken || cancelled) return;
        const data = await api.post('/auth/sso', { token: ssoToken, app: SSO_APP_KEY });
        if (cancelled || !data?.user || !(data.user.roles || [data.user.role]).includes('hr_admin')) return;
        storeSession(data.token, data.user);
        setToken(data.token);
        setUser(data.user);
      } catch {
        /* portal unreachable or no account linked: show the login page as usual */
      } finally {
        if (!cancelled) setSsoChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Re-validate a stored token on load; a stale/revoked token drops to login via the 401 handler.
  useEffect(() => {
    if (!token) return;
    api.get('/auth/me')
      .then((d) => {
        setUser(d.user);
        storeSession(getToken(), d.user);
      })
      .catch(() => { /* 401 already handled globally */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    // Checks membership, not the primary role — staff who also sit on interview
    // panels (Parag, Rajkumar, the recruiter) use this one login for both panels.
    if (!data.user || !(data.user.roles || [data.user.role]).includes('hr_admin')) {
      throw new Error('This panel is for HR administrators only');
    }
    storeSession(data.token, data.user);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, ssoChecking }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
