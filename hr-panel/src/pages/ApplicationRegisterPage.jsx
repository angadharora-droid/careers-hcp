import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { inr, fmtDate, band } from '../lib/format';
import { exportCSV } from '../lib/export';
import { exportExcel, STANDING_TEXT } from '../lib/excel';
import { ErrorBox, Empty, TableSkeleton, Spinner } from '../components/LoadState';
import { BandPill } from '../components/Badges';
import PageHeader from '../components/PageHeader';
import ApplicantDrawer from '../components/ApplicantDrawer';
import {
  Search, ArrowLeft, Printer, Download, ClipboardList, ClipboardCheck,
  AlertTriangle, CheckCircle, Flag, X, Inbox, Check,
  ArrowUpDown, ChevronUp, ChevronDown,
} from '../components/Icons';
import { useToast } from '../context/ToastContext';

/* The Application Register — the recruitment control format kept separately for
   each vacant post. Section A tracks every applicant against that post, Section B
   and Section B records the selection and its approval chain.

   Everything except HR's own annotations is compiled server-side from positions,
   applications and panel scores, so the register cannot disagree with the pipeline.
   The four Section A fields HR fills in here (relevant hotel experience, last
   employer, notice period, remarks) save the moment the cell loses focus. */

const CHIP = 'inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] whitespace-nowrap';

const SCREENING_STYLES = {
  Shortlisted: 'bg-brand-green/10 text-brand-green',
  'Not shortlisted': 'bg-brand-red/10 text-brand-red',
  'On hold': 'bg-muted/12 text-muted',
  Pending: 'bg-brand-blue/10 text-brand-blue',
};

const DECISION_STYLES = {
  Selected: 'bg-brand-green/10 text-brand-green',
  Rejected: 'bg-brand-red/10 text-brand-red',
  'On hold': 'bg-muted/12 text-muted',
  'Final pending': 'bg-brand-amber/12 text-brand-amber',
  Pending: 'bg-brand-blue/10 text-brand-blue',
};

// Applications that arrived after the post stopped taking them.
const FLAG_STYLES = {
  'Talent Pool': 'bg-[#1f6b82]/10 text-[#1f6b82]',
  'Post Closed': 'bg-footer text-cream',
};

const REGISTER_CSV = [
  { header: 'Sr.', value: (r) => r.sr },
  { header: 'Application ID', value: (r) => r.application_id },
  { header: 'Date', value: (r) => r.date },
  { header: 'Candidate Name', value: (r) => r.candidate_name },
  { header: 'Fit (1-3)', value: (r) => r.fit?.stars ?? '' },
  { header: 'Fit Label', value: (r) => r.fit?.label ?? '' },
  { header: 'Mobile No.', value: (r) => r.mobile },
  { header: 'Source', value: (r) => r.source },
  { header: 'Qualification', value: (r) => r.qualification },
  { header: 'Total Exp.', value: (r) => (r.total_experience_years == null ? '' : `${r.total_experience_years} yrs`) },
  { header: 'Relevant Hotel Exp.', value: (r) => (r.relevant_hotel_experience_years == null ? '' : `${r.relevant_hotel_experience_years} yrs`) },
  { header: 'Current / Last Employer', value: (r) => r.current_employer },
  { header: 'Current Salary', value: (r) => r.current_salary ?? '' },
  { header: 'Current vs Band', value: (r) => r.current_salary_standing || '' },
  { header: 'Expected Salary', value: (r) => r.expected_salary ?? '' },
  { header: 'Expected vs Band', value: (r) => r.expected_salary_standing || '' },
  { header: 'Notice Period', value: (r) => r.notice_period },
  { header: 'Screening', value: (r) => r.screening },
  { header: 'Interview Status', value: (r) => r.interview_status },
  { header: 'Final Decision', value: (r) => r.final_decision },
  { header: 'Remarks', value: (r) => r.remarks },
  { header: 'Register Flag', value: (r) => r.register_flag },
];

const slug = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

/* ISO → the register's dd-mm-yyyy, matching how the paper form writes dates.
   A bare 'YYYY-MM-DD' is reformatted as text rather than parsed: `new Date()`
   reads it as UTC midnight, which lands on the previous day west of Greenwich. */
function regDate(d) {
  if (!d) return '';
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (plain) return `${plain[3]}-${plain[2]}-${plain[1]}`;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getDate())}-${p(x.getMonth() + 1)}-${x.getFullYear()}`;
}

/* ===== Fit rating — 1-3 stars, computed server-side =====
   Same reading as the coloured Excel export: panel verdict once one exists,
   affordability of the expectation, and how much of the experience is hotel
   experience. Null (no stars) means nothing on file to judge on — an honest
   blank, not a one-star verdict. */

const FIT_TONES = {
  3: 'text-brand-green',
  2: 'text-brand-amber',
  1: 'text-brand-red',
};

const FIT_ROW_TINT = {
  3: 'reg-fit-3',
  2: 'reg-fit-2',
  1: 'reg-fit-1',
};

function FitStars({ fit }) {
  if (!fit) {
    return <span className="mini" title="No signals on file yet — screening details or a panel score start the rating">not rated</span>;
  }
  const full = '★'.repeat(fit.stars);
  const empty = '☆'.repeat(3 - fit.stars);
  return (
    <span
      className={`whitespace-nowrap font-semibold ${FIT_TONES[fit.stars]}`}
      title={`${fit.label} (${fit.score}/100${fit.confidence !== 'high' ? `, ${fit.confidence} confidence` : ''}) — ${fit.basis.join(' · ')}`}
    >
      <span aria-hidden="true" className="text-[14px] tracking-[1px]">{full}</span>
      <span aria-hidden="true" className="text-[14px] tracking-[1px] opacity-40">{empty}</span>
      <span className="sr-only">{fit.stars} of 3 stars — {fit.label}</span>
    </span>
  );
}

/* ===== Sorting =====
   The register is kept in the order applications arrived, and `Sr.` is the
   permanent serial that order assigned — so sorting reorders the ROWS on screen
   without ever renumbering them. Clearing the sort returns to register order. */

const SORTS = {
  fit: { get: (r) => (r.fit ? r.fit.stars * 1000 + r.fit.score : null) },
  date: { get: (r) => new Date(r.applied_on).getTime() },
  candidate_name: { get: (r) => r.candidate_name || '', string: true },
  qualification: { get: (r) => r.qualification || '', string: true },
  total_experience_years: { get: (r) => r.total_experience_years },
  relevant_hotel_experience_years: { get: (r) => r.relevant_hotel_experience_years },
  current_employer: { get: (r) => r.current_employer || '', string: true },
  current_salary: { get: (r) => r.current_salary },
  expected_salary: { get: (r) => r.expected_salary },
};

function sortRows(rows, sort) {
  if (!sort.key) return rows;
  const { get, string } = SORTS[sort.key];
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    // Blanks sink to the bottom whichever way the column is pointing — a row with
    // no notice period recorded is not "the lowest", it is simply unfilled.
    const aEmpty = va == null || va === '';
    const bEmpty = vb == null || vb === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const cmp = string ? String(va).localeCompare(String(vb)) : va - vb;
    return cmp * sort.dir;
  });
}

function SortHeader({ id, sort, onSort, className = '', title, children }) {
  const active = sort.key === id;
  const IconCmp = !active ? ArrowUpDown : sort.dir === 1 ? ChevronUp : ChevronDown;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 uppercase tracking-[1.5px] font-medium cursor-pointer transition-colors duration-150 hover:text-berry ${active ? 'text-berry' : ''}`}
        onClick={() => onSort(id)}
        title={title || (active
          ? (sort.dir === 1 ? 'Sorted lowest first — click for highest first' : 'Sorted highest first — click to clear')
          : 'Sort lowest first')}
      >
        {children}
        <IconCmp size={11} className={active ? 'text-berry' : 'text-muted/70'} />
      </button>
    </th>
  );
}

/* ===== What a candidate earns and expects, against the post's band =====
   The same three-way reading as a hired salary, but it means something different
   on each column, so the cell carries a tooltip rather than relying on colour
   alone (colour is never the only carrier of the meaning). */

const SALARY_TONES = {
  'Within band': 'text-brand-green',
  'Under band': 'text-brand-amber',
  'Over band': 'text-brand-red',
};

const SALARY_TITLES = {
  current: {
    'Within band': 'Currently earning inside the sanctioned band — a lateral move',
    'Under band': 'Currently earning below the band — this post is a step up',
    'Over band': 'Currently earning above the band — this post is a pay cut, so check retention',
  },
  expected: {
    'Within band': 'Expectation sits inside the sanctioned band — affordable',
    'Under band': 'Expecting below the band — cheap, but check the fit is right',
    'Over band': 'Expecting more than the band allows — needs a rethink or an approval',
  },
};

function SalaryCell({ value, standing, kind }) {
  if (value == null) return <span className="mini">—</span>;
  return (
    <span
      className={`whitespace-nowrap font-medium ${SALARY_TONES[standing] || ''}`}
      title={SALARY_TITLES[kind][standing] || 'No salary band is set for this post'}
    >
      {inr(value)}
      {standing && (
        <span className="sr-only"> — {standing}</span>
      )}
    </span>
  );
}

// Legend, so the colours are explained once rather than guessed at.
function SalaryLegend({ band: b }) {
  if (!b || (!b.min && !b.max)) {
    return (
      <span className="mini">
        No salary band is set for this post, so current and expected salaries are shown uncoloured.
      </span>
    );
  }
  return (
    <span className="mini flex items-center gap-x-3 gap-y-1 flex-wrap">
      <span>Salaries against the sanctioned band <b>{band(b.min, b.max)}</b>:</span>
      <span className="text-brand-green font-medium">within</span>
      <span className="text-brand-amber font-medium">under</span>
      <span className="text-brand-red font-medium">over</span>
    </span>
  );
}

/* ===== Inline register cell — saves on blur, reverts on failure ===== */

function EditCell({ value, onSave, type = 'text', placeholder = '—', className = '', title }) {
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);

  // Re-sync when the row is refetched (another edit, or a reload).
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  async function commit() {
    const next = type === 'number' ? (draft === '' ? null : Number(draft)) : String(draft).trim();
    if (type === 'number' && next !== null && !Number.isFinite(next)) { setDraft(value ?? ''); return; }
    if (String(next ?? '') === String(value ?? '')) return; // untouched
    setBusy(true);
    try {
      await onSave(next);
    } catch {
      setDraft(value ?? ''); // caller toasts the error; the cell goes back to truth
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative block">
      <input
        className={`w-full bg-transparent border border-transparent rounded-sm px-1.5 py-1 text-xs text-body placeholder:text-muted/50 transition-colors duration-150 hover:border-line focus:border-berry focus:bg-card focus:outline-none ${className}`}
        type={type === 'number' ? 'number' : 'text'}
        step={type === 'number' ? '0.5' : undefined}
        min={type === 'number' ? '0' : undefined}
        value={draft}
        placeholder={placeholder}
        title={title}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setDraft(value ?? ''); e.currentTarget.blur(); }
        }}
      />
      {busy && <Spinner className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3" />}
    </span>
  );
}

/* ===== The funnel — where this post's applicants actually stand =====
   Counted off the same derived columns Section A shows, so the strip and the
   table can never disagree. Each tile filters the table below rather than
   navigating away: the register is one page, and the numbers are its index. */

const FUNNEL = [
  { key: '', label: 'All', tone: 'ink', match: () => true },
  { key: 'shortlisted', label: 'Shortlisted', tone: 'green', match: (r) => r.screening === 'Shortlisted' },
  { key: 'interviewed', label: 'Interviewed', tone: 'blue', match: (r) => r.rounds_scored > 0 },
  { key: 'pending', label: 'Awaiting decision', tone: 'amber', match: (r) => ['Pending', 'Final pending'].includes(r.final_decision) },
  { key: 'selected', label: 'Selected', tone: 'green', match: (r) => r.final_decision === 'Selected' },
  { key: 'rejected', label: 'Rejected', tone: 'red', match: (r) => r.final_decision === 'Rejected' },
  { key: 'flagged', label: 'Talent pool / closed', tone: 'muted', match: (r) => Boolean(r.register_flag) },
  { key: 'bestfit', label: '★★★ Best fit', tone: 'green', match: (r) => r.fit?.stars === 3 },
];

const FUNNEL_TONE = {
  ink: 'text-ink',
  green: 'text-brand-green',
  blue: 'text-brand-blue',
  amber: 'text-brand-amber',
  red: 'text-brand-red',
  muted: 'text-muted',
};

function FunnelStrip({ rows, active, onPick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 mb-4">
      {FUNNEL.map((f) => {
        const n = rows.filter(f.match).length;
        const on = active === f.key;
        return (
          <button
            key={f.key || 'all'}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on && f.key ? '' : f.key)}
            disabled={n === 0 && Boolean(f.key)}
            className={`text-left bg-card border rounded-md px-3 py-2.5 transition-colors duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-default active:scale-[0.99] ${
              on ? 'border-berry ring-1 ring-berry/30' : 'border-line hover:border-berry/60'
            }`}
          >
            <div className={`font-display text-[24px] font-semibold leading-none tabular-nums ${FUNNEL_TONE[f.tone]}`}>{n}</div>
            <div className="font-button text-[10px] font-medium text-muted uppercase tracking-[1.2px] mt-1.5 leading-tight">
              {f.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* Jump links between the three sections — the register is long, and Section B is
   the part HR comes back to. Anchors rather than tabs, so printing still emits
   the whole document. */
function SectionNav({ counts }) {
  const items = [
    { href: '#section-a', label: 'A · Applications', n: counts.rows },
    { href: '#section-b', label: 'B · Selection & approval', n: counts.selection },
  ];
  return (
    <nav aria-label="Register sections" className="flex gap-1.5 flex-wrap mb-4 no-print">
      {items.map((i) => (
        <a
          key={i.href}
          href={i.href}
          className="inline-flex items-center gap-1.5 font-button text-[11px] font-medium uppercase tracking-[1.5px] px-3 py-1.5 rounded-sm border border-line bg-card text-body hover:text-berry hover:border-berry transition-colors duration-150"
        >
          {i.label}
          {i.n != null && <span className="tabular-nums font-semibold">{i.n}</span>}
        </a>
      ))}
    </nav>
  );
}

/* ===== The post picker ===== */

function PostPicker({ posts, loading, err, onRetry, onOpen }) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [openOnly, setOpenOnly] = useState(false);

  const departments = useMemo(
    () => [...new Set(posts.map((p) => p.department).filter(Boolean))].sort(),
    [posts]
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (dept && p.department !== dept) return false;
      if (openOnly && p.open_vacancies === 0) return false;
      if (!needle) return true;
      return `${p.designation} ${p.job_code} ${p.department}`.toLowerCase().includes(needle);
    });
  }, [posts, q, dept, openOnly]);

  return (
    <div className="card">
      <div className="infobar">
        <b>One register per vacant post.</b> The Application Register is maintained separately for each
        post/designation, so pick the post whose applicants you want to track. Every application against that
        job code appears in Section A under its own Application ID.
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            className="inp w-auto min-w-[230px] pl-8"
            placeholder="Search post / job code…"
            aria-label="Search posts"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="inp w-auto min-w-[170px]" aria-label="Filter by department" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 text-[12.5px] text-body cursor-pointer select-none">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open vacancies only
        </label>
        <span className="mini tabular-nums ml-auto">Showing {shown.length} of {posts.length} posts</span>
      </div>

      <ErrorBox error={err} onRetry={onRetry} />

      {loading ? (
        <TableSkeleton rows={8} />
      ) : shown.length === 0 ? (
        <Empty
          icon={ClipboardList}
          title={posts.length ? 'No posts match' : 'No posts yet'}
          action={
            posts.length ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setDept(''); setOpenOnly(false); }}>
                Clear filters
              </button>
            ) : null
          }
        >
          {posts.length
            ? 'Try widening the search or clearing the department filter.'
            : 'Registers appear once positions are sanctioned in the Position Register.'}
        </Empty>
      ) : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Post Applied For</th><th>Job Code</th><th>Dept</th><th>Grade</th>
                <th className="num">Vacancies</th><th className="num">Applications</th>
                <th className="num">Pending</th><th className="num">Selected</th>
                <th>Register</th><th><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.key}>
                  <td className="font-semibold text-ink">{p.designation}</td>
                  <td className="pcn">{p.job_code}</td>
                  <td>{p.department || '—'}</td>
                  <td>{p.grade || '—'}</td>
                  <td className="num">
                    <b>{p.open_vacancies}</b>
                    <span className="mini"> / {p.seats_total} seats</span>
                  </td>
                  <td className="num">{p.applications}</td>
                  <td className="num">{p.pending || <span className="mini">—</span>}</td>
                  <td className="num">{p.selected || <span className="mini">—</span>}</td>
                  <td>
                    <span className={`${CHIP} ${p.is_closed ? 'bg-footer text-cream' : 'bg-brand-green/10 text-brand-green'}`}>
                      {p.is_closed ? 'Closed' : 'Open'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm" onClick={() => onOpen(p)}>Open register</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ===== Header block — the sample format's nine identifying fields ===== */

function HeaderField({ label, children }) {
  return (
    <div className="flex border border-line rounded-sm overflow-hidden">
      <div className="w-[124px] shrink-0 bg-footer text-cream px-2.5 py-2 font-button text-[10.5px] font-medium uppercase tracking-[1.2px] leading-tight flex items-center">
        {label}
      </div>
      <div className="flex-1 bg-card px-3 py-2 text-[12.5px] text-ink flex items-center min-w-0">
        <span className="truncate">{children}</span>
      </div>
    </div>
  );
}

function HeaderBlock({ header }) {
  const period = header.date_opened
    ? `${regDate(header.date_opened)} — ${header.date_closed ? regDate(header.date_closed) : 'open'}`
    : '—';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 mb-5">
      <HeaderField label="Company / Unit">{header.unit}</HeaderField>
      <HeaderField label="Post Applied For">{header.designation || '—'}</HeaderField>
      <HeaderField label="Department">{header.department || '—'}</HeaderField>
      <HeaderField label="Job Code"><span className="font-mono font-bold text-berry">{header.job_code}</span></HeaderField>
      <HeaderField label="No. of Vacancies">
        {header.vacancies}
        <span className="mini"> ({header.open_vacancies} still open of {header.seats_total} sanctioned seats)</span>
      </HeaderField>
      <HeaderField label="Register Owner">{header.register_owner}</HeaderField>
      <HeaderField label="Recruitment Period">{period}</HeaderField>
      <HeaderField label="Date Opened">{header.date_opened ? regDate(header.date_opened) : '—'}</HeaderField>
      <HeaderField label="Date Closed">
        {header.date_closed
          ? regDate(header.date_closed)
          : <span className="mini">still recruiting</span>}
      </HeaderField>
    </div>
  );
}

/* ===== Section B — the selection and approval record ===== */

const APPROVAL_FIELDS = [
  { key: 'recommended_by', label: 'Recommended By', placeholder: 'e.g. General Manager' },
  { key: 'salary_approved_by', label: 'Salary Approved By', placeholder: 'e.g. Approving Authority' },
  { key: 'approval_date', label: 'Approval Date', type: 'date' },
  { key: 'offer_issued_date', label: 'Offer Issued Date', type: 'date' },
  { key: 'employee_code', label: 'Employee Code (after joining)', placeholder: 'filled in once the candidate joins' },
  { key: 'closed_by', label: 'Application Closed By', placeholder: 'e.g. P&C Manager' },
];

function DerivedRow({ label, children }) {
  return (
    <tr>
      <th scope="row" className="reg-particular">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

function SelectionRecord({ record, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() =>
    Object.fromEntries(APPROVAL_FIELDS.map((f) => [f.key, record[f.key] || '']))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  /* Re-sync only when the stored record actually changes value. `record` is a new
     object on every refetch, so depending on its identity would wipe half-typed
     approval details whenever a Section A cell was saved elsewhere on the page. */
  const stored = JSON.stringify(APPROVAL_FIELDS.map((f) => record[f.key] || ''));
  useEffect(() => {
    setForm(Object.fromEntries(APPROVAL_FIELDS.map((f) => [f.key, record[f.key] || ''])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, stored]);

  const dirty = APPROVAL_FIELDS.some((f) => (form[f.key] || '') !== (record[f.key] || ''));

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api.patch(`/applications/${record.id}/approval`, form);
      toast(`Approval record saved for ${record.candidate_selected}`);
      await onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Flagged before the save is attempted, rather than only on rejection.
  const salaryMissing = record.recommended_salary == null;
  const approvalMissing = !form.salary_approved_by || !form.approval_date;
  const offerBlocked = salaryMissing || approvalMissing;

  return (
    <div className="border border-line rounded-sm overflow-hidden mb-4 last:mb-0">
      <div className="bg-beige px-3.5 py-2 border-b border-line flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-[15px] font-semibold text-ink">{record.candidate_selected}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-berry">{record.application_id}</span>
          {record.pcn && <span className={`${CHIP} bg-brand-green/10 text-brand-green`}>Seat {record.pcn}</span>}
        </span>
      </div>

      <table className="tbl border-0">
        <tbody>
          <DerivedRow label="Candidate Selected"><b>{record.candidate_selected}</b></DerivedRow>
          <DerivedRow label="Application ID">
            <span className="font-mono font-bold text-berry">{record.application_id}</span>
          </DerivedRow>
          <DerivedRow label="Recommended Designation / Grade">{record.recommended_designation || '—'}</DerivedRow>
          <DerivedRow label="Recommended Salary">
            {record.recommended_salary == null ? (
              <span className="mini">not set — record the offered salary on the application first</span>
            ) : (
              <span className="inline-flex items-center gap-2 flex-wrap">
                <b>{inr(record.recommended_salary)} per month</b>
                <BandPill standing={record.band_standing} />
              </span>
            )}
            {record.salary_band && (
              <div className="mini mt-1">
                Sanctioned band for this seat: {band(record.salary_band.min, record.salary_band.max)}
              </div>
            )}
          </DerivedRow>
          <DerivedRow label="Interviewed By">
            {record.interviewer_names?.length ? (
              record.interviewer_names.map((n, i) => (
                <span key={`${n}-${i}`}>
                  {i > 0 && ' and '}
                  {n}
                  {record.interviewed_by?.[i] && record.interviewed_by[i] !== n && (
                    <span className="mini"> ({record.interviewed_by[i]})</span>
                  )}
                </span>
              ))
            ) : (
              <span className="mini">no panel recorded</span>
            )}
          </DerivedRow>

          {APPROVAL_FIELDS.map((f) => (
            <tr key={f.key}>
              <th scope="row" className="reg-particular">{f.label}</th>
              <td>
                <input
                  className="inp py-1.5 min-h-0 sm:min-h-0 max-w-[340px]"
                  type={f.type === 'date' ? 'date' : 'text'}
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  aria-label={f.label}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
                {f.key === 'offer_issued_date' && offerBlocked && (
                  <div className="mini text-brand-amber mt-1 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-px" />
                    {salaryMissing ? 'The offered salary' : 'The salary approving authority and approval date'} must be recorded before an offer is issued.
                  </div>
                )}
                {f.key === 'employee_code' && !form.offer_issued_date && (
                  <div className="mini mt-1">Available once the offer issued date is recorded.</div>
                )}
              </td>
            </tr>
          ))}

          <DerivedRow label="Expected Joining Date">
            {record.expected_joining_date
              ? regDate(record.expected_joining_date)
              : <span className="mini">set the date of joining on the application</span>}
          </DerivedRow>
          <DerivedRow label="Offer Letter">
            {record.offer_sent_at ? (
              <>
                <span className={`${CHIP} bg-brand-green/10 text-brand-green`}>
                  {record.offer_sent_method === 'manual' ? 'Sent manually' : 'Emailed'} {fmtDate(record.offer_sent_at)}
                </span>
                <div className="mini mt-1">
                  {record.offer_sent_to}
                  {record.offer_sent_note && ` · ${record.offer_sent_note}`}
                  {record.offer_sent_by_name && ` · recorded by ${record.offer_sent_by_name}`}
                </div>
              </>
            ) : (
              <span className="mini">
                not sent yet — email it from the applicant drawer, or send it yourself and record it there
              </span>
            )}
          </DerivedRow>
        </tbody>
      </table>

      <div className="px-3.5 py-2.5 border-t border-line bg-cream/40 flex flex-wrap items-center gap-2 no-print">
        <ErrorBox error={err} />
        <button type="button" className="btn btn-sm" onClick={save} disabled={busy || !dirty}>
          {busy ? <Spinner className="w-3.5 h-3.5" /> : <ClipboardCheck size={13} />}
          {busy ? 'Saving…' : 'Save approval record'}
        </button>
        {!dirty && !busy && (
          <span className="mini">
            {record.approval_complete
              ? 'Approval chain complete.'
              : 'Fill in the recommender and approving authority.'}
          </span>
        )}
      </div>
    </div>
  );
}

/* ===== The page ===== */

export default function ApplicationRegisterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const jobCode = searchParams.get('job_code') || '';
  const designation = searchParams.get('designation') || '';

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsErr, setPostsErr] = useState(null);

  const [reg, setReg] = useState(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regErr, setRegErr] = useState(null);
  const [openId, setOpenId] = useState(null);
  // Section A view state — which funnel tile is active, and the name/ID search.
  const [funnel, setFunnel] = useState('');
  const [rowQ, setRowQ] = useState('');
  // null key = register order, the order the applications arrived in.
  const [sort, setSort] = useState({ key: null, dir: 1 });

  const loadPosts = useCallback(async () => {
    setPostsErr(null);
    try {
      const d = await api.get('/register/posts');
      setPosts(d.posts || []);
    } catch (e) {
      setPostsErr(e.message);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  const loadRegister = useCallback(async () => {
    if (!jobCode) { setReg(null); return; }
    setRegErr(null);
    setRegLoading(true);
    try {
      const params = new URLSearchParams({ job_code: jobCode });
      if (designation) params.set('designation', designation);
      setReg(await api.get(`/register?${params.toString()}`));
    } catch (e) {
      setRegErr(e.message);
      setReg(null);
    } finally {
      setRegLoading(false);
    }
  }, [jobCode, designation]);

  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { loadRegister(); }, [loadRegister]);
  // A different post is a different register: its filters start clean.
  useEffect(() => { setFunnel(''); setRowQ(''); setSort({ key: null, dir: 1 }); }, [jobCode, designation]);

  // Saving a Section A cell writes straight to the application, then refetches so
  // every derived column (screening, decision, flags) stays in step.
  async function saveCell(row, field, value) {
    try {
      await api.patch(`/applications/${row.id}`, { [field]: value });
      await loadRegister();
    } catch (e) {
      toast(e.message, 'error');
      throw e;
    }
  }

  /* Ascending, then descending, then back to register order — so there is always
     a way back to the sequence the register is actually kept in. */
  function toggleSort(key) {
    setSort((cur) => {
      if (cur.key !== key) return { key, dir: 1 };
      if (cur.dir === 1) return { key, dir: -1 };
      return { key: null, dir: 1 };
    });
  }

  function openPost(p) {
    setSearchParams({ job_code: p.job_code, designation: p.designation });
  }

  if (!jobCode) {
    return (
      <div>
        <PageHeader
          title="Application Register"
          sub="Recruitment control format · one register per vacant post"
        />
        <PostPicker
          posts={posts}
          loading={postsLoading}
          err={postsErr}
          onRetry={loadPosts}
          onOpen={openPost}
        />
      </div>
    );
  }

  const [xlsxBusy, setXlsxBusy] = useState(false);

  const header = reg?.header;
  const rows = reg?.rows || [];

  /* What Section A actually shows: the funnel tile narrows by outcome, the search
     by person. The CSV and the print copy follow this same set, so what you export
     is what you were looking at. */
  const shown = sortRows(
    rows.filter((r) => {
      const tile = FUNNEL.find((f) => f.key === funnel);
      if (tile && !tile.match(r)) return false;
      const needle = rowQ.trim().toLowerCase();
      if (!needle) return true;
      return `${r.candidate_name} ${r.application_id} ${r.mobile} ${r.current_employer}`.toLowerCase().includes(needle);
    }),
    sort
  );
  const narrowed = Boolean(funnel || rowQ.trim());
  const csvName = `application-register-${slug(designation || header?.designation || jobCode)}-${slug(jobCode)}.csv`;

  /* The Excel export carries what CSV cannot: each row tinted by fit, three-star
     candidates bold, a legend at the foot. Exports the rows as currently
     filtered and sorted, so what downloads is what was on screen. */
  async function exportXlsx() {
    setXlsxBusy(true);
    try {
      await exportExcel(
        csvName.replace(/\.csv$/, '.xlsx'),
        [
          { header: 'Sr.', value: (r) => r.sr, width: 5 },
          { header: 'Application ID', value: (r) => r.application_id, width: 14 },
          { header: 'Date', value: (r) => r.date, width: 10 },
          { header: 'Candidate Name', value: (r) => r.candidate_name, width: 20 },
          { header: 'Fit', value: (r) => (r.fit ? '★'.repeat(r.fit.stars) : ''), width: 7 },
          { header: 'Fit Reading', value: (r) => r.fit?.label ?? 'Not rated', width: 12 },
          { header: 'Mobile No.', value: (r) => r.mobile, width: 13 },
          { header: 'Source', value: (r) => r.source, width: 10 },
          { header: 'Qualification', value: (r) => r.qualification, width: 14 },
          { header: 'Total Exp. (yrs)', value: (r) => r.total_experience_years ?? '', width: 9 },
          { header: 'Hotel Exp. (yrs)', value: (r) => r.relevant_hotel_experience_years ?? '', width: 9 },
          { header: 'Current / Last Employer', value: (r) => r.current_employer, width: 20 },
          { header: 'Current Salary', value: (r) => r.current_salary ?? '', width: 12, numFmt: '#,##0', fontColor: (r) => STANDING_TEXT[r.current_salary_standing] || null },
          { header: 'Expected Salary', value: (r) => r.expected_salary ?? '', width: 12, numFmt: '#,##0', fontColor: (r) => STANDING_TEXT[r.expected_salary_standing] || null },
          { header: 'Expected vs Band', value: (r) => r.expected_salary_standing ?? '', width: 12 },
          { header: 'Notice Period', value: (r) => r.notice_period, width: 11 },
          { header: 'Screening', value: (r) => r.screening, width: 12 },
          { header: 'Interview Status', value: (r) => r.interview_status, width: 16 },
          { header: 'Panel Avg', value: (r) => r.panel_average ?? '', width: 9 },
          { header: 'Final Decision', value: (r) => r.final_decision, width: 12 },
          { header: 'Remarks', value: (r) => r.remarks, width: 22 },
        ],
        shown,
        {
          sheetName: 'Application Register',
          title: `APPLICATION REGISTER — ${(designation || header?.designation || '').toUpperCase()}`,
          subtitle: `${header?.job_code || jobCode} · ${header?.department || ''} · exported ${new Date().toLocaleDateString('en-IN')}`,
          fitOf: (r) => r.fit?.stars ?? null,
        }
      );
      toast('Excel register downloaded');
    } catch (e) {
      toast(`Excel export failed: ${e.message}`, 'error');
    } finally {
      setXlsxBusy(false);
    }
  }

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Application Register"
          sub={header ? `${header.designation} · ${header.job_code}` : 'Recruitment control format'}
          action={
            <span className="flex gap-2 flex-wrap">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearchParams({})}>
                <ArrowLeft size={13} />
                All posts
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => exportCSV(csvName, REGISTER_CSV, shown)}
                disabled={shown.length === 0}
                title="Plain CSV — no colours, opens anywhere"
              >
                <Download size={13} />
                CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => exportXlsx()}
                disabled={shown.length === 0 || xlsxBusy}
                title="Excel workbook with the best-fitted candidates highlighted"
              >
                <Download size={13} />
                {xlsxBusy ? 'Building…' : 'Excel'}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => window.print()} disabled={!reg}>
                <Printer size={13} />
                Print register
              </button>
            </span>
          }
        />
      </div>

      {/* Print-only masthead, matching the paper format's title block */}
      <div className="hidden print-only text-center mb-4">
        <h1 className="font-display text-[22px] font-bold text-ink">APPLICATION REGISTER — RECRUITMENT</h1>
        <p className="text-[12px] text-muted mt-1">To be maintained separately for each vacant post/designation</p>
      </div>

      <ErrorBox error={regErr} onRetry={loadRegister} />

      {regLoading && !reg ? (
        <div className="card"><TableSkeleton rows={8} /></div>
      ) : !reg ? null : (
        <>
          <HeaderBlock header={header} />

          <div className="no-print">
            <FunnelStrip rows={rows} active={funnel} onPick={setFunnel} />
            <SectionNav counts={{ rows: rows.length, selection: reg.selection.length }} />
          </div>

          <div className="card" id="section-a">
            <div className="card-h">
              A. Application Tracking Register
              <span className="r tabular-nums">
                {narrowed ? `${shown.length} of ${rows.length}` : rows.length} application{rows.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="infobar no-print">
              <b>Screening, interview status and final decision are read from the pipeline</b> — they update
              themselves as the panel scores and HR moves the stage. The four tinted
              columns are yours to fill in: relevant hotel experience, last employer, notice period and remarks.
              Each saves when you leave the cell.
            </div>

            {rows.length > 0 && (
              <div className="flex gap-2 flex-wrap items-center mb-3 no-print">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    className="inp w-auto min-w-[230px] pl-8"
                    placeholder="Find a candidate / application ID…"
                    aria-label="Search this register"
                    value={rowQ}
                    onChange={(e) => setRowQ(e.target.value)}
                  />
                </div>
                {narrowed && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setFunnel(''); setRowQ(''); }}
                  >
                    <X size={12} />
                    Clear {funnel && rowQ.trim() ? 'filters' : 'filter'}
                  </button>
                )}
                {sort.key && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSort({ key: null, dir: 1 })}>
                    <X size={12} />
                    Register order
                  </button>
                )}
                <span className="mini ml-auto">Scroll sideways for the full register · the first four columns stay put</span>
              </div>
            )}

            {rows.length > 0 && (
              <div className="mb-3 no-print">
                <SalaryLegend band={header.salary_band} />
              </div>
            )}

            {rows.length === 0 ? (
              <Empty icon={ClipboardList} title="No applications against this post yet">
                Candidates who apply on the public Careers site are entered here automatically, each with a
                unique Application ID.
              </Empty>
            ) : shown.length === 0 ? (
              <Empty
                icon={Inbox}
                title="No application matches"
                action={
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFunnel(''); setRowQ(''); }}>
                    Clear filters
                  </button>
                }
              >
                Try a different search, or pick another tile above.
              </Empty>
            ) : (
              <div className="tbl-scroll reg-freeze">
                <table className="tbl">
                  <thead>
                    {/* Column families, so seventeen columns read as five groups */}
                    <tr>
                      <th className="reg-group rf rf1" aria-hidden="true" />
                      <th className="reg-group rf rf2" colSpan={1}>Identity</th>
                      <th className="reg-group rf rf3" aria-hidden="true" />
                      <th className="reg-group rf rf4" aria-hidden="true" />
                      <th className="reg-group">Fit</th>
                      <th className="reg-group" colSpan={3}>Applicant</th>
                      <th className="reg-group" colSpan={2}>Experience</th>
                      <th className="reg-group" colSpan={4}>Current terms</th>
                      <th className="reg-group" colSpan={3}>Outcome</th>
                      <th className="reg-group">Register</th>
                      <th className="reg-group no-print" aria-hidden="true" />
                    </tr>
                    <tr>
                      <th className="num rf rf1" title="The register serial, fixed when the application arrived">Sr.</th>
                      <th className="rf rf2">Application ID</th>
                      <SortHeader id="date" sort={sort} onSort={toggleSort} className="rf rf3">Date</SortHeader>
                      <SortHeader id="candidate_name" sort={sort} onSort={toggleSort} className="rf rf4">Candidate Name</SortHeader>
                      <SortHeader id="fit" sort={sort} onSort={toggleSort} title="Sort weakest fit first — click again for best first">Fit</SortHeader>
                      <th>Mobile No.</th>
                      <th>Source</th>
                      <SortHeader id="qualification" sort={sort} onSort={toggleSort}>Qualification</SortHeader>
                      <SortHeader id="total_experience_years" sort={sort} onSort={toggleSort} className="num">Total Exp.</SortHeader>
                      <SortHeader id="relevant_hotel_experience_years" sort={sort} onSort={toggleSort} className="num">Relevant Hotel Exp.</SortHeader>
                      <SortHeader id="current_employer" sort={sort} onSort={toggleSort}>Current / Last Employer</SortHeader>
                      <SortHeader id="current_salary" sort={sort} onSort={toggleSort} className="num">Current Salary</SortHeader>
                      <SortHeader id="expected_salary" sort={sort} onSort={toggleSort} className="num">Expected Salary</SortHeader>
                      <th>Notice Period</th>
                      <th>Screening</th>
                      <th>Interview Status</th>
                      <th>Final Decision</th>
                      <th>Remarks</th>
                      <th className="no-print"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id} className={r.fit ? FIT_ROW_TINT[r.fit.stars] : undefined}>
                        <td className="num rf rf1">{r.sr}</td>
                        <td className="rf rf2">
                          <span className="font-mono font-bold text-berry text-xs">{r.application_id}</span>
                          {r.register_flag && (
                            <div className="mt-1">
                              <span className={`${CHIP} ${FLAG_STYLES[r.register_flag]}`}>{r.register_flag}</span>
                            </div>
                          )}
                        </td>
                        <td className="rf rf3 whitespace-nowrap tabular-nums">{r.date}</td>
                        <td className="rf rf4">
                          <b className="text-ink">{r.candidate_name}</b>
                          {r.pcn && <div className="mini font-mono">{r.pcn}</div>}
                        </td>
                        <td><FitStars fit={r.fit} /></td>
                        <td className="whitespace-nowrap tabular-nums">{r.mobile}</td>
                        <td>{r.source || '—'}</td>
                        <td>{r.qualification || '—'}</td>
                        <td className="num whitespace-nowrap">
                          {r.total_experience_years == null ? '—' : `${r.total_experience_years} yrs`}
                        </td>
                        <td className="reg-edit">
                          <EditCell
                            value={r.relevant_hotel_experience_years}
                            type="number"
                            placeholder="yrs"
                            className="text-right"
                            title="Years of hotel-industry experience relevant to this post"
                            onSave={(v) => saveCell(r, 'relevant_hotel_experience_years', v)}
                          />
                        </td>
                        <td className="reg-edit min-w-[150px]">
                          <EditCell
                            value={r.current_employer}
                            placeholder={r.current_designation || 'employer'}
                            title="Current or last employer"
                            onSave={(v) => saveCell(r, 'current_employer', v)}
                          />
                        </td>
                        <td className="num">
                          <SalaryCell value={r.current_salary} standing={r.current_salary_standing} kind="current" />
                        </td>
                        <td className="num">
                          <SalaryCell value={r.expected_salary} standing={r.expected_salary_standing} kind="expected" />
                        </td>
                        <td className="reg-edit min-w-[110px]">
                          <EditCell
                            value={r.notice_period}
                            placeholder="e.g. 30 days"
                            title="Notice period the candidate must serve"
                            onSave={(v) => saveCell(r, 'notice_period', v)}
                          />
                        </td>
                        <td>
                          <span className={`${CHIP} ${SCREENING_STYLES[r.screening] || 'bg-muted/12 text-muted'}`}>
                            {r.screening}
                          </span>
                        </td>
                        <td>
                          <span className="whitespace-nowrap">{r.interview_status}</span>
                          {r.rounds_scored > 0 && (
                            <div className="mini tabular-nums">
                              {r.rounds_scored}/{r.rounds} scored
                              {r.panel_average != null && ` · ${r.panel_average}/100`}
                              {r.any_red_flags && (
                                <Flag size={11} className="inline-block ml-1 text-brand-red align-[-1px]" label="Red flag raised" />
                              )}
                            </div>
                          )}
                          {r.interview_date && r.rounds_scored === 0 && (
                            <div className="mini">{r.interview_date}</div>
                          )}
                        </td>
                        <td>
                          <span className={`${CHIP} ${DECISION_STYLES[r.final_decision] || 'bg-muted/12 text-muted'}`}>
                            {r.final_decision}
                          </span>
                          {r.rejection_reason && <div className="mini mt-1">{r.rejection_reason}</div>}
                        </td>
                        <td className="reg-edit min-w-[160px]">
                          <EditCell
                            value={r.remarks}
                            placeholder="add a note"
                            title="Register remarks for this application"
                            onSave={(v) => saveCell(r, 'remarks', v)}
                          />
                        </td>
                        <td className="no-print">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenId(r.id)}>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" id="section-b">
            <div className="card-h">
              B. Selection and Approval Record
              {reg.selection.length > 1 && (
                <span className="r tabular-nums">{reg.selection.length} selections</span>
              )}
            </div>

            {reg.selection.length === 0 ? (
              <Empty icon={CheckCircle} title="No candidate selected yet">
                Once a candidate is moved to Selected against a sanctioned seat, their approval record opens
                here — recommender, salary approving authority, approval and offer dates, and the employee code
                that closes the loop.
              </Empty>
            ) : (
              reg.selection.map((s) => (
                <SelectionRecord key={s.id} record={s} onSaved={loadRegister} />
              ))
            )}
          </div>

        </>
      )}

      {openId && (
        <ApplicantDrawer
          applicationId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => { loadRegister(); loadPosts(); }}
        />
      )}
    </div>
  );
}
