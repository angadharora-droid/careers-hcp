const API = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'cph_interviewer_token';
const USER_KEY = 'cph_interviewer_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function handleUnauthorized() {
  clearSession();
  window.dispatchEvent(new Event('cph:unauthorized'));
}

/**
 * Small fetch wrapper. Attaches the Bearer token, parses JSON, throws
 * Error(body.error) on !res.ok (backend error strings are user-facing),
 * and bounces to login on any 401.
 */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Network error — could not reach the server.');
  }

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired — please log in again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok) {
    throw new Error((data && data.error) || res.statusText || 'Request failed');
  }
  return data;
}

/** Download an uploaded document via GET /files/:filename (Bearer token, blob). */
export async function downloadDocument(filename, originalName) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API}/files/${encodeURIComponent(filename)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error('Network error — could not download the file.');
  }
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired — please log in again.');
  }
  if (!res.ok) {
    let msg = res.statusText || 'Could not download the file';
    try {
      const d = await res.json();
      if (d && d.error) msg = d.error;
    } catch {
      /* not JSON */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = originalName || filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
