// Small fetch wrapper for the public Career Panel.
// Dev traffic goes through the Vite proxy ('/api' -> http://localhost:5000);
// production deployments can set VITE_API_URL.
const API = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, options);
  } catch {
    throw new Error('Unable to reach the server. Please check your connection and try again.');
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response (unexpected) — handled below via res.ok
  }

  if (!res.ok) {
    const err = new Error((body && body.error) || res.statusText || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return body;
}

/** GET /public/positions → { roles: [Role] } */
export function getPositions() {
  return request('/public/positions');
}

/** GET /public/positions/:job_code → { role } (404 if not open) */
export function getPosition(jobCode) {
  return request(`/public/positions/${encodeURIComponent(jobCode)}`);
}

/** POST /public/applications — multipart/form-data → { reference_id, message } */
export function submitApplication(formData) {
  // No Content-Type header: the browser sets the multipart boundary itself.
  return request('/public/applications', { method: 'POST', body: formData });
}
