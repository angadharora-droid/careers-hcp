/** en-IN short date, tolerant of empty / unparseable values. */
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Recommendation band for a weighted /100 total (client-side preview only). */
export function recommendationFor(total) {
  if (total >= 85) return 'Strongly Recommend';
  if (total >= 70) return 'Recommend';
  if (total >= 55) return 'Hold';
  return 'Do Not Recommend';
}

/** A1–A3 manager grades interview via a 3-member committee. */
export function isCommitteeGrade(grade) {
  return typeof grade === 'string' && grade.startsWith('A');
}
