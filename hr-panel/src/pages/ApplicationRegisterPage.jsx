import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { inr, fmtDate, band } from '../lib/format';
import { exportCSV } from '../lib/export';
import { ErrorBox, Empty, TableSkeleton, Spinner } from '../components/LoadState';
import { BandPill } from '../components/Badges';
import PageHeader from '../components/PageHeader';
import ApplicantDrawer from '../components/ApplicantDrawer';
import {
  Search, ArrowLeft, Printer, Download, ClipboardList, ClipboardCheck,
  AlertTriangle, CheckCircle, Flag,
} from '../components/Icons';
import { useToast } from '../context/ToastContext';

/* The Application Register — the recruitment control format kept separately for
   each vacant post. Section A tracks every applicant against that post, Section B
   records the selection and its approval chain, Section C lists the control points
   the register exists to enforce.

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

// Control point 7 — applications that arrived after the post stopped taking them.
const FLAG_STYLES = {
  'Talent Pool': 'bg-[#1f6b82]/10 text-[#1f6b82]',
  'Post Closed': 'bg-footer text-cream',
};

const REGISTER_CSV = [
  { header: 'Sr.', value: (r) => r.sr },
  { header: 'Application ID', value: (r) => r.application_id },
  { header: 'Date', value: (r) => r.date },
  { header: 'Candidate Name', value: (r) => r.candidate_name },
  { header: 'Mobile No.', value: (r) => r.mobile },
  { header: 'Source', value: (r) => r.source },
  { header: 'Qualification', value: (r) => r.qualification },
  { header: 'Total Exp.', value: (r) => (r.total_experience_years == null ? '' : `${r.total_experience_years} yrs`) },
  { header: 'Relevant Hotel Exp.', value: (r) => (r.relevant_hotel_experience_years == null ? '' : `${r.relevant_hotel_experience_years} yrs`) },
  { header: 'Current / Last Employer', value: (r) => r.current_employer },
  { header: 'Current Salary', value: (r) => r.current_salary ?? '' },
  { header: 'Expected Salary', value: (r) => r.expected_salary ?? '' },
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
        job code appears in Section A with its own Application ID — control point 1.
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

  // Control point 5, shown before it is hit rather than only on save.
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
              <span className="mini">no panel recorded — control point 4</span>
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
                    Control point 5 — {salaryMissing ? 'the offered salary' : 'the salary approving authority and approval date'} must be recorded before an offer is issued.
                  </div>
                )}
                {f.key === 'employee_code' && !form.offer_issued_date && (
                  <div className="mini mt-1">Available once the offer issued date is recorded (control point 6).</div>
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
              <span className={`${CHIP} bg-brand-green/10 text-brand-green`}>
                Emailed {fmtDate(record.offer_sent_at)}{record.offer_sent_to ? ` · ${record.offer_sent_to}` : ''}
              </span>
            ) : (
              <span className="mini">not sent yet — generate it from the applicant drawer</span>
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
              : 'Fill in the recommender and approving authority — control point 4.'}
          </span>
        )}
      </div>
    </div>
  );
}

/* ===== Section C — control points and sign-off ===== */

function SignatureBox({ role }) {
  return (
    <div className="border border-line rounded-sm overflow-hidden">
      <div className="bg-footer text-cream px-3 py-2 font-button text-[10.5px] font-medium uppercase tracking-[1.2px] text-center">
        {role}
      </div>
      <div className="bg-card px-3 py-3.5 text-[12px] text-muted leading-[2.4]">
        Name: <span className="inline-block border-b border-line w-[62%] align-baseline" /><br />
        Signature: <span className="inline-block border-b border-line w-[54%] align-baseline" /><br />
        Date: <span className="inline-block border-b border-line w-[65%] align-baseline" />
      </div>
    </div>
  );
}

function ControlPoints({ points }) {
  return (
    <div className="card">
      <div className="card-h">C. Mandatory Control Points</div>
      <ol className="border border-line rounded-sm overflow-hidden mb-5">
        {points.map((p, i) => (
          <li key={p} className={`flex gap-3 px-3 py-2 text-[12.5px] text-body ${i % 2 ? 'bg-cream/50' : 'bg-card'} ${i ? 'border-t border-line' : ''}`}>
            <span className="w-6 shrink-0 text-center font-button text-[11px] font-semibold text-berry tabular-nums">{i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <SignatureBox role="Prepared / Updated By" />
        <SignatureBox role="Reviewed By" />
        <SignatureBox role="Approved By" />
      </div>
      <p className="mini mt-3">
        This format follows the unit's approved recruitment policy. Screening, interview outcome and rejection
        reasons in Section A are read from the pipeline, so the register and the applicant record can never disagree.
      </p>
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

  const header = reg?.header;
  const rows = reg?.rows || [];
  const csvName = `application-register-${slug(designation || header?.designation || jobCode)}-${slug(jobCode)}.csv`;

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
                onClick={() => exportCSV(csvName, REGISTER_CSV, rows)}
                disabled={rows.length === 0}
                title="Download Section A as a CSV spreadsheet"
              >
                <Download size={13} />
                Export CSV
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

          <div className="card">
            <div className="card-h">
              A. Application Tracking Register
              <span className="r tabular-nums">{rows.length} application{rows.length === 1 ? '' : 's'}</span>
            </div>

            <div className="infobar no-print">
              <b>Screening, interview status and final decision are read from the pipeline</b> — they update
              themselves as the panel scores and HR moves the stage, satisfying control point 3. The four tinted
              columns are yours to fill in: relevant hotel experience, last employer, notice period and remarks.
              Each saves when you leave the cell.
            </div>

            {rows.length === 0 ? (
              <Empty icon={ClipboardList} title="No applications against this post yet">
                Candidates who apply on the public Careers site are entered here automatically, each with a
                unique Application ID.
              </Empty>
            ) : (
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="num">Sr.</th>
                      <th>Application ID</th>
                      <th>Date</th>
                      <th>Candidate Name</th>
                      <th>Mobile No.</th>
                      <th>Source</th>
                      <th>Qualification</th>
                      <th className="num">Total Exp.</th>
                      <th className="num">Relevant Hotel Exp.</th>
                      <th>Current / Last Employer</th>
                      <th className="num">Current Salary</th>
                      <th className="num">Expected Salary</th>
                      <th>Notice Period</th>
                      <th>Screening</th>
                      <th>Interview Status</th>
                      <th>Final Decision</th>
                      <th>Remarks</th>
                      <th className="no-print"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="num">{r.sr}</td>
                        <td>
                          <span className="font-mono font-bold text-berry text-xs">{r.application_id}</span>
                          {r.register_flag && (
                            <div className="mt-1">
                              <span className={`${CHIP} ${FLAG_STYLES[r.register_flag]}`}>{r.register_flag}</span>
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap tabular-nums">{r.date}</td>
                        <td>
                          <b className="text-ink">{r.candidate_name}</b>
                          {r.pcn && <div className="mini font-mono">{r.pcn}</div>}
                        </td>
                        <td className="whitespace-nowrap tabular-nums">{r.mobile}</td>
                        <td>{r.source || '—'}</td>
                        <td>{r.qualification || '—'}</td>
                        <td className="num whitespace-nowrap">
                          {r.total_experience_years == null ? '—' : `${r.total_experience_years} yrs`}
                        </td>
                        <td className="bg-berry-soft/40 p-0.5">
                          <EditCell
                            value={r.relevant_hotel_experience_years}
                            type="number"
                            placeholder="yrs"
                            className="text-right"
                            title="Years of hotel-industry experience relevant to this post"
                            onSave={(v) => saveCell(r, 'relevant_hotel_experience_years', v)}
                          />
                        </td>
                        <td className="bg-berry-soft/40 p-0.5 min-w-[150px]">
                          <EditCell
                            value={r.current_employer}
                            placeholder={r.current_designation || 'employer'}
                            title="Current or last employer"
                            onSave={(v) => saveCell(r, 'current_employer', v)}
                          />
                        </td>
                        <td className="num whitespace-nowrap">{inr(r.current_salary)}</td>
                        <td className="num whitespace-nowrap">{inr(r.expected_salary)}</td>
                        <td className="bg-berry-soft/40 p-0.5 min-w-[110px]">
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
                        <td className="bg-berry-soft/40 p-0.5 min-w-[160px]">
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

          <div className="card">
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

          <ControlPoints points={reg.control_points} />
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
