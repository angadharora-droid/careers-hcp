export function inr(n) {
  if (n === null || n === undefined || n === '') return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}

export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// The sanctioned band as one cell: "₹22,000 – ₹28,000", or a single figure when
// only one end is set. Returns '—' when no band is on file.
export function band(min, max) {
  const lo = Number(min) || 0;
  const hi = Number(max) || 0;
  if (lo <= 0 && hi <= 0) return '—';
  if (lo > 0 && hi > 0) return lo === hi ? inr(lo) : `${inr(lo)} – ${inr(hi)}`;
  return inr(lo > 0 ? lo : hi);
}

/* Where an actual offer sits against a seat's band. Mirrors the server's
   bandStanding so a row can be labelled without a round trip; null means no band
   was ever set, which reads differently from "inside the band". */
export function bandStanding(offered, min, max) {
  if (offered == null || offered === '' || !Number.isFinite(Number(offered))) return null;
  const lo = Number(min) || 0;
  const hi = Number(max) || 0;
  if (lo <= 0 && hi <= 0) return null;
  const n = Number(offered);
  if (hi > 0 && n > hi) return 'Over band';
  if (lo > 0 && n < lo) return 'Under band';
  return 'Within band';
}
