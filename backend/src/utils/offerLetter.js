// Builds a branded, self-contained HTML offer letter for a Selected candidate.
// Rendered in-browser (print / Save-as-PDF) and used as the email body. All CSS is
// inline in a <style> block so it travels as one file with no external assets.

const UNIT = 'Centre Point Amravati';
const COMPANY = 'Centre Point Hospitality';
const ADDRESS = 'Centre Point Amravati · Camp Road, Amravati, Maharashtra 444602';

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function inr(n) {
  if (n === null || n === undefined || n === '') return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}

// 'YYYY-MM-DD' → '01 August 2026'. Falls back to the raw string if unparseable.
function longDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function buildOfferLetter(app, { position = null, forEmail = false } = {}) {
  const today = longDate(new Date().toISOString().slice(0, 10));
  const doj = longDate(app.date_of_joining);
  const salary = inr(app.offered_salary);
  const reportsTo = position?.reports_to || '';
  const annual = app.offered_salary != null ? inr(Number(app.offered_salary) * 12) : '—';

  const printButton = forEmail ? '' : `
    <div class="noprint actions">
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offer Letter — ${esc(app.candidate_name)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #f8ede2; color: #393939;
    font-family: "Inter", -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 14px; line-height: 1.65;
  }
  .sheet {
    max-width: 720px; margin: 24px auto; background: #ffffff;
    border: 1px solid #e6d9c8; padding: 48px 56px;
  }
  .head { border-bottom: 2px solid #a80564; padding-bottom: 16px; margin-bottom: 8px; }
  .wordmark { font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 700; color: #000; letter-spacing: .5px; }
  .unit { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #a80564; margin-top: 4px; }
  .addr { font-size: 11px; color: #6b6257; margin-top: 2px; }
  .meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #6b6257; margin: 20px 0 6px; }
  .confidential { text-transform: uppercase; letter-spacing: 1.5px; font-size: 10.5px; color: #a80564; font-weight: 600; }
  h1 { font-family: Georgia, serif; font-size: 20px; font-weight: 600; color: #000; margin: 22px 0 14px; }
  p { margin: 0 0 12px; }
  .terms { background: #f8ede2; border: 1px solid #e6d9c8; border-radius: 4px; padding: 4px 18px; margin: 16px 0; }
  table.kv { width: 100%; border-collapse: collapse; margin: 6px 0 16px; }
  table.kv td { padding: 7px 4px; border-bottom: 1px solid #efddc9; vertical-align: top; font-size: 13px; }
  table.kv td.k { color: #6b6257; width: 210px; }
  table.kv td.v { font-weight: 600; color: #000; }
  .mono { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; color: #a80564; font-weight: 700; }
  ol { margin: 0 0 12px; padding-left: 20px; }
  ol li { margin-bottom: 6px; }
  .sign { margin-top: 34px; }
  .sign .row { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  .sign .block { min-width: 240px; margin-top: 20px; }
  .sign .line { border-top: 1px solid #393939; padding-top: 6px; font-size: 12px; }
  .foot { margin-top: 28px; border-top: 1px solid #e6d9c8; padding-top: 12px; font-size: 10.5px; color: #6b6257; }
  .actions { text-align: center; margin: 18px auto 0; max-width: 720px; }
  .actions button {
    font-family: "Inter", sans-serif; text-transform: uppercase; letter-spacing: 1.5px; font-size: 12px;
    background: #a80564; color: #fff; border: none; border-radius: 4px; padding: 11px 22px; cursor: pointer;
  }
  @media print {
    body { background: #fff; }
    .sheet { border: none; margin: 0; max-width: none; padding: 0; }
    .noprint { display: none !important; }
  }
</style>
</head>
<body>
${printButton}
<div class="sheet">
  <div class="head">
    <div class="wordmark">Centre Point</div>
    <div class="unit">${esc(COMPANY)} · ${esc(UNIT)}</div>
    <div class="addr">${esc(ADDRESS)}</div>
  </div>

  <div class="meta">
    <span class="confidential">Private &amp; Confidential</span>
    <span>Ref: <b>${esc(app.reference_id)}</b> · Date: ${esc(today)}</span>
  </div>

  <p>
    <b>${esc(app.candidate_name)}</b><br />
    ${esc(app.email || '')}${app.mobile ? ' · ' + esc(app.mobile) : ''}
  </p>

  <h1>Offer of Employment — ${esc(app.designation)}</h1>

  <p>Dear ${esc(app.candidate_name)},</p>

  <p>
    Following your interview with our selection panel, we are pleased to offer you the position of
    <b>${esc(app.designation)}</b> (Grade ${esc(app.grade)}) in the ${esc(app.department)} department at
    ${esc(UNIT)}. We were impressed by your candidature and look forward to welcoming you to the team.
  </p>

  <p>The principal terms of your appointment are set out below:</p>

  <div class="terms">
    <table class="kv">
      <tr><td class="k">Designation</td><td class="v">${esc(app.designation)}</td></tr>
      <tr><td class="k">Department</td><td class="v">${esc(app.department)}</td></tr>
      <tr><td class="k">Grade</td><td class="v">${esc(app.grade)}</td></tr>
      ${reportsTo ? `<tr><td class="k">Reports To</td><td class="v">${esc(reportsTo)}</td></tr>` : ''}
      <tr><td class="k">Position Code (PCN)</td><td class="v"><span class="mono">${esc(app.pcn)}</span></td></tr>
      <tr><td class="k">Date of Joining</td><td class="v">${esc(doj)}</td></tr>
      <tr><td class="k">Consolidated Salary</td><td class="v">${esc(salary)} per month (${esc(annual)} per annum)</td></tr>
      <tr><td class="k">Place of Posting</td><td class="v">${esc(UNIT)}</td></tr>
    </table>
  </div>

  <p>This offer is made on the following standard terms:</p>
  <ol>
    <li>Your appointment is subject to a probation period of six (6) months, during which your performance will be reviewed.</li>
    <li>This offer is contingent on satisfactory verification of your documents, references and previous employment.</li>
    <li>Please carry originals and copies of your identity proof, educational and experience certificates, and recent photographs on the date of joining.</li>
    <li>You will be governed by the service rules, code of conduct and grooming standards of ${esc(COMPANY)}.</li>
    <li>This offer will lapse if you do not join on or before the date of joining stated above, unless extended in writing by Human Resources.</li>
  </ol>

  <p>
    Kindly confirm your acceptance by signing and returning a copy of this letter. We look forward to a long and
    rewarding association.
  </p>

  <div class="sign">
    <div class="row">
      <div class="block">
        <p style="margin-bottom:32px;">For ${esc(COMPANY)},</p>
        <div class="line">Authorised Signatory · Human Resources</div>
      </div>
      <div class="block">
        <p style="margin-bottom:32px;">Accepted by candidate,</p>
        <div class="line">${esc(app.candidate_name)} · Date</div>
      </div>
    </div>
  </div>

  <div class="foot">
    This letter is computer-generated for ${esc(UNIT)} recruitment and is valid without a physical seal until countersigned.
    For queries, contact the Human Resources department.
  </div>
</div>
</body>
</html>`;
}
