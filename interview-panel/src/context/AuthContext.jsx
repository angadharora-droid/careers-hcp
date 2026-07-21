import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearSession, getStoredUser, getToken, setSession } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

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
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
