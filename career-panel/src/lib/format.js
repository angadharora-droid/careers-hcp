/** ₹ + Indian-grouped number, or null when the value isn't a number. */
export function inr(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return `₹${n.toLocaleString('en-IN')}`;
}

/** en-IN short date, e.g. "16 Jul 2026". Falls back to the raw string. */
export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** en-IN date, plus the time when the value carries one (e.g. interview slots). */
export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (d.getHours() === 0 && d.getMinutes() === 0) return date;
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

/** Candidate-friendly seniority wording: "Executive / Officer / Specialist" → "Executive level". */
export function friendlyLevel(gradeLabel) {
  if (!gradeLabel) return null;
  const first = String(gradeLabel).split('/')[0].trim();
  if (!first) return null;
  return /level$/i.test(first) ? first : `${first} level`;
}

/** First body sentence of a job description, skipping heading lines and bullets. */
export function descriptionTeaser(text) {
  if (!text) return '';
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('•'));
  // Headings in our JDs are short label lines ("About the role"); body copy is sentence-length.
  return lines.find((l) => l.length > 60) || lines[0] || '';
}

/** Whitespace-delimited word count (0 for blank text). */
export function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
