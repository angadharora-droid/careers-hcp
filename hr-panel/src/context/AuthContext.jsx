import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearSession, getToken, setUnauthorizedHandler, storedUser, storeSession } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getToken());
  const [user, setUser] = useState(() => storedUser());

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
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
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
