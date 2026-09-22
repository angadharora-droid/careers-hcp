import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearSession, getStoredUser, getToken, setSession } from '../lib/api';
import { SSO_APP_KEY, resolveSsoToken, ssoEnabled, ssoLogout } from '../lib/sso';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  // True while we ask the portal whether this visitor is already signed in —
  // only when there is no stored token and central sign-on is configured.
  const [ssoChecking, setSsoChecking] = useState(() => !getToken() && ssoEnabled());

  // Central sign-on: with no stored token, the portal cookie may still identify
  // this visitor. The hand-off token is exchanged for the same { token, user } a
  // password login returns and stored the same way; the interviewer membership
  // check applies exactly as in login(). Anything else falls through to /login.
  useEffect(() => {
    if (!ssoChecking) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const ssoToken = await resolveSsoToken();
        if (!ssoToken || cancelled) return;
        const data = await api('/auth/sso', { method: 'POST', body: { token: ssoToken, app: SSO_APP_KEY } });
        if (cancelled || !data || !data.user || !(data.user.roles || [data.user.role]).includes('interviewer')) return;
        setSession(data.token, data.user);
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

  // Any 401 anywhere clears the session and drops back to the login screen.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('cph:unauthorized', onUnauthorized);
    return () => window.removeEventListener('cph:unauthorized', onUnauthorized);
  }, []);

  // Silently re-validate a stored token on load; a 401 is handled above.
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => {
        if (d && d.user) {
          setSession(getToken(), d.user);
          setUser(d.user);
        }
      })
      .catch(() => {
        /* network errors are ignored; 401s already cleared the session */
      });
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    // Membership check: an HR admin who also holds interview rounds gets in here too.
    if (!data || !data.user || !(data.user.roles || [data.user.role]).includes('interviewer')) {
      throw new Error('This panel is for interview panellists only — use your interviewer login.');
    }
    setSession(data.token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    ssoLogout(); // end the portal session too, or the next load signs back in
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, ssoChecking }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
