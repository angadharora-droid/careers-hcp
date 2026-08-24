/* Real .xlsx export, with the rows actually coloured.

   CSV cannot carry colour — it is plain text, and Excel applies none of its own.
   So the register exports a genuine workbook instead: banded header, frozen
   header row, auto-filter, sized columns, and each row tinted by how well the
   candidate fits the post.

   ExcelJS is ~900KB, which has no business sitting in the initial bundle for a
   button most sessions never press. It is imported dynamically, so the bundler
   splits it into its own chunk that downloads on the first export and is cached
   after that. */

/* Excel's own conditional-formatting palette — the green/amber/red every Excel
   user already knows how to read, and saturated enough to carry across a room.
   (The first cut used quieter tints; they read as dull on a real register.) */
const FIT_FILLS = {
  3: 'FFC6EFCE', // green — strong fit
  2: 'FFFFEB9C', // amber — possible fit
  1: 'FFFFC7CE', // red   — weak fit
};

const FIT_TEXT = {
  3: 'FF006100',
  2: 'FF9C6500',
  1: 'FF9C0006',
};

const HEADER_BG = 'FF1F2A44';
const BORDER = 'FFD9D2C7';

/* Band-standing text colours for the salary columns — same hues the fit rows
   use, so one legend covers both. */
export const STANDING_TEXT = {
  'Within band': 'FF006100',
  'Under band': 'FF9C6500',
  'Over band': 'FF9C0006',
};

const stars = (n) => (n ? '★'.repeat(n) + '☆'.repeat(3 - n) : '');

/**
 * @param filename  what the browser saves it as
 * @param columns   [{ header, value(row), width?, numFmt? }]
 * @param rows      the rows already on screen, in the order they are shown
 * @param options   { sheetName, title, subtitle, fitOf(row) -> 1|2|3|null }
 */
export async function exportExcel(filename, columns, rows, options = {}) {
  const { sheetName = 'Register', title, subtitle, fitOf = () => null } = options;

  // Split out of the main bundle — see the note above.
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Centre Point — Recruitment & Position Control';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: title ? 3 : 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Title block, when the caller wants the sheet to identify itself.
  if (title) {
    const t = ws.addRow([title]);
    t.font = { bold: true, size: 14, color: { argb: 'FF1F2A44' } };
    ws.mergeCells(t.number, 1, t.number, columns.length);
    if (subtitle) {
      const st = ws.addRow([subtitle]);
      st.font = { size: 10, color: { argb: 'FF6B6257' } };
      ws.mergeCells(st.number, 1, st.number, columns.length);
    } else {
      ws.addRow([]);
    }
  }

  const head = ws.addRow(columns.map((c) => c.header));
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER } },
      left: { style: 'thin', color: { argb: BORDER } },
      bottom: { style: 'thin', color: { argb: BORDER } },
      right: { style: 'thin', color: { argb: BORDER } },
    };
  });
  head.height = 28;

  for (const r of rows) {
    const row = ws.addRow(columns.map((c) => c.value(r)));
    const fit = fitOf(r);
    row.eachCell({ includeEmpty: true }, (cell, i) => {
      cell.alignment = { vertical: 'top', wrapText: false };
      cell.font = { size: 10 };
      cell.border = {
        top: { style: 'hair', color: { argb: BORDER } },
        left: { style: 'hair', color: { argb: BORDER } },
        bottom: { style: 'hair', color: { argb: BORDER } },
        right: { style: 'hair', color: { argb: BORDER } },
      };
      if (fit && FIT_FILLS[fit]) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FIT_FILLS[fit] } };
        // Dark text in the matching hue; three-star rows also bold, so the
        // candidates worth landing on first stand out even in greyscale print.
        cell.font = { size: 10, bold: fit === 3, color: { argb: FIT_TEXT[fit] } };
      }
      const col = columns[i - 1];
      if (col?.numFmt) cell.numFmt = col.numFmt;
      /* A column may colour its own text per row — the salary columns paint
         themselves by band standing. Applied last, over the row-tint font, so
         the cell's own verdict wins; bold keeps it legible on the tinted rows. */
      const own = col?.fontColor?.(r);
      if (own) cell.font = { ...(cell.font || {}), size: 10, bold: true, color: { argb: own } };
    });
  }

  columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 16; });

  // Auto-filter over the header, so the sheet is sortable the moment it opens.
  const headerRowNumber = head.number;
  ws.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber + rows.length, column: columns.length },
  };

  // A legend, so the colours mean something to whoever the file is forwarded to.
  ws.addRow([]);
  const legendTitle = ws.addRow(['Fit rating']);
  legendTitle.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1F2A44' } };
  for (const n of [3, 2, 1]) {
    const label = n === 3 ? 'Strong fit' : n === 2 ? 'Possible fit' : 'Weak fit';
    const lr = ws.addRow([`${stars(n)}  ${label}`]);
    const cell = lr.getCell(1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FIT_FILLS[n] } };
    cell.font = { size: 10, bold: n === 3, color: { argb: FIT_TEXT[n] } };
  }
  const note = ws.addRow(['Unshaded rows carry no rating — nothing on file to judge them on yet.']);
  note.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF6B6257' } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export { stars };
