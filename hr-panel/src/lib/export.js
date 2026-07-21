// Client-side CSV export of the rows already on screen. `columns` is
// [{ header, value }] where value(row) returns the cell — so an export always
// mirrors the current filtered/sorted view the caller passes in.

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BOM = String.fromCharCode(0xfeff); // makes Excel read UTF-8 (₹, accents) correctly

export function exportCSV(filename, columns, rows) {
  const header = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(',')).join('\r\n');
  const blob = new Blob([BOM + header + '\r\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// yyyy-mm-dd stamp for export filenames.
export function stamp() {
  return new Date().toISOString().slice(0, 10);
}
