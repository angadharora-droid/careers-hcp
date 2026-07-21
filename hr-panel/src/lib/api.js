const API = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'hr_token';
const USER_KEY = 'hr_user';

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) { unauthorizedHandler = fn; }

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function storedUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Any 401 outside the login call itself drops the session back to the login screen.
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    clearSession();
    if (unauthorizedHandler) unauthorizedHandler();
    throw new Error('Session expired — please sign in again');
  }

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) throw new Error((data && data.error) || res.statusText || 'Request failed');
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// Uploaded documents need the Authorization header, so fetch as a blob and
// hand the browser an object URL instead of a plain <a href>.
export async function downloadDocument(filename, originalName) {
  const res = await fetch(`${API}/files/${encodeURIComponent(filename)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    let msg = res.statusText || 'Download failed';
    try { msg = (await res.json()).error || msg; } catch { /* binary/empty */ }
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
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// In-browser preview for uploaded documents (PDF and images render natively in
// a tab). Fetch as a blob so the Authorization header goes along, then open the
// object URL. Falls back to a download if the pop-up is blocked.
export async function previewDocument(filename, originalName) {
  const res = await fetch(`${API}/files/${encodeURIComponent(filename)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    let msg = res.statusText || 'Preview failed';
    try { msg = (await res.json()).error || msg; } catch { /* binary/empty */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = originalName || filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Offer letter is auth-protected HTML — fetch as a blob and open it in a new tab
// (where HR can review and Print / Save-as-PDF). Falls back to a download if the
// pop-up is blocked.
export async function openOfferLetter(applicationId) {
  const res = await fetch(`${API}/applications/${applicationId}/offer-letter`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    let msg = res.statusText || 'Could not open offer letter';
    try { msg = (await res.json()).error || msg; } catch { /* html/empty */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'offer-letter.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
