import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { exportCSV, stamp } from '../lib/export';
import { ErrorBox, Empty, TableSkeleton } from '../components/LoadState';
import { StageBadge } from '../components/Badges';
import ApplicantDrawer from '../components/ApplicantDrawer';
import PageHeader from '../components/PageHeader';
import { Search, AlertTriangle, Flag, Users, Download } from '../components/Icons';

const STAGES = ['Applied', 'Interview Scheduled', 'Selected', 'Rejected', 'On Hold'];

// CSV columns for the applications export (mirrors the filtered table on screen).
const APP_CSV = [
  { header: 'Reference', value: (a) => a.reference_id },
  { header: 'Candidate', value: (a) => a.candidate_name },
  { header: 'Email', value: (a) => a.email },
  { header: 'Mobile', value: (a) => a.mobile },
  { header: 'Job Code', value: (a) => a.job_code },
  { header: 'Designation', value: (a) => a.designation },
  { header: 'Grade', value: (a) => a.grade },
  { header: 'Department', value: (a) => a.department },
  { header: 'Experience (yrs)', value: (a) => a.total_experience_years ?? '' },
  { header: 'Stage', value: (a) => a.stage },
  { header: 'Panel Avg', value: (a) => a.score_summary?.average ?? '' },
  { header: 'Scores', value: (a) => (a.score_summary ? `${a.score_summary.count}/${a.score_summary.needed}` : '') },
  { header: 'Red Flag', value: (a) => (a.score_summary?.any_red_flags ? 'Yes' : '') },
  { header: 'Applied On', value: (a) => fmtDate(a.applied_on) },
  { header: 'Source', value: (a) => a.source || '' },
  { header: 'Rejection Reason', value: (a) => a.rejection_reason || '' },
  { header: 'Interview Date', value: (a) => a.interview_date || '' },
  { header: 'Date of Joining', value: (a) => a.date_of_joining || '' },
  { header: 'Offered Salary', value: (a) => a.offered_salary ?? '' },
  { header: 'PCN', value: (a) => a.pcn || '' },
];

export function ScoreCell({ summary }) {
  if (!summary || !summary.count) return <span className="mini">—</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <b>{summary.average}</b>/100 <span className="mini">({summary.count}/{summary.needed})</span>
      {summary.diverged && (
        <span
          className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-sm text-[11px] font-bold bg-brand-red/10 text-brand-red align-middle"
          title={`Scores diverged by ${summary.spread} points`}
        >
          <AlertTriangle size={11} />
          {summary.spread}
        </span>
      )}
      {summary.any_red_flags && (
        <Flag size={12} className="inline-block ml-1 text-brand-red align-[-1px]" label="Red flag raised" />
      )}
    </span>
  );
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [dept, setDept] = useState('');
  const [job, setJob] = useState('');
  const [openId, setOpenId] = useState(null);

  const debounce = useRef(null);

  // One search-scoped fetch feeds both the table and the live stage counts;
  // the stage strip then filters client-side (same data, instant chips).
  const load = useCallback(async (filters) => {
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      const qs = params.toString();
      const d = await api.get(`/applications${qs ? `?${qs}` : ''}`);
      setApps(d.applications || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load({ q }), q ? 250 : 0);
    return () => clearTimeout(debounce.current);
  }, [q, load]);

  // Filter options come from the applications actually on hand, so the dropdowns
  // never offer a department or role with nothing behind it. Jobs narrow to the
  // chosen department.
  const departments = useMemo(
    () => [...new Set(apps.map((a) => a.department).filter(Boolean))].sort(),
    [apps]
  );
  const jobs = useMemo(() => {
    const pool = dept ? apps.filter((a) => a.department === dept) : apps;
    const byCode = new Map();
    for (const a of pool) if (a.job_code && !byCode.has(a.job_code)) byCode.set(a.job_code, a.designation);
    return [...byCode].sort((x, y) => String(x[1]).localeCompare(String(y[1])));
  }, [apps, dept]);

  // Department/job narrow the pool the stage chips count, so a chip always reports
  // how many of THAT filtered set sit at that stage.
  const scoped = useMemo(
    () => apps.filter((a) => (!dept || a.department === dept) && (!job || a.job_code === job)),
    [apps, dept, job]
  );

  const counts = useMemo(() => {
    const c = {};
    for (const s of STAGES) c[s] = 0;
    for (const a of scoped) if (c[a.stage] !== undefined) c[a.stage] += 1;
    return c;
  }, [scoped]);

  const displayed = useMemo(
    () => (stage ? scoped.filter((a) => a.stage === stage) : scoped),
    [scoped, stage]
  );

  const filtered = Boolean(q || stage || dept || job);
  function clearAll() { setQ(''); setStage(''); setDept(''); setJob(''); }

  // Name the export after whatever narrowed it, so downloaded files stay tellable apart.
  const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  function csvScope() {
    const parts = [dept && slug(dept), job && slug(job), stage && slug(stage)].filter(Boolean);
    return parts.length ? `${parts.join('-')}-` : '';
  }

  function stageChipCls(active) {
    return `inline-flex items-center gap-1.5 font-button text-[11px] font-medium uppercase tracking-[1.5px] px-3 py-1.5 min-h-10 rounded-sm border cursor-pointer transition-colors duration-150 active:scale-[0.98] ${
      active
        ? 'bg-berry text-white border-berry'
        : 'bg-card text-body border-line hover:text-berry hover:border-berry'
    }`;
  }

  return (
    <div>
      <PageHeader
        title="Applications & Pipeline"
        sub="Selection fills the PCN · panel scores gate the offer"
      />

      <div className="card">
        {/* Stage summary strip — live counts, click to filter */}
        <div className="flex gap-1.5 flex-wrap items-center mb-3">
          <button
            type="button"
            className={stageChipCls(!stage)}
            aria-pressed={!stage}
            onClick={() => setStage('')}
          >
            All
            <span className="tabular-nums font-semibold">{scoped.length}</span>
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              className={stageChipCls(stage === s)}
              aria-pressed={stage === s}
              onClick={() => setStage(stage === s ? '' : s)}
            >
              {s}
              <span className="tabular-nums font-semibold">{counts[s]}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              className="inp w-auto min-w-[230px] pl-8"
              placeholder="Search name / job code / ref…"
              aria-label="Search applications"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select
            className="inp w-auto min-w-[170px]"
            aria-label="Filter by department"
            value={dept}
            onChange={(e) => {
              const next = e.target.value;
              setDept(next);
              // The chosen role may not exist in the new department — drop it.
              if (job && next && !apps.some((a) => a.job_code === job && a.department === next)) setJob('');
            }}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            className="inp w-auto min-w-[210px]"
            aria-label="Filter by job"
            value={job}
            onChange={(e) => setJob(e.target.value)}
          >
            <option value="">All jobs{dept ? ` in ${dept}` : ''}</option>
            {jobs.map(([code, designation]) => (
              <option key={code} value={code}>{designation}</option>
            ))}
          </select>

          {filtered && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
              Clear filters
            </button>
          )}

          <button
            type="button"
            className="btn btn-ghost btn-sm ml-auto"
            onClick={() => exportCSV(`applications-${csvScope()}${stamp()}.csv`, APP_CSV, displayed)}
            disabled={displayed.length === 0}
            title="Download the applications shown below as a CSV spreadsheet"
          >
            <Download size={13} />
            Export CSV
          </button>
          <span className="mini tabular-nums">Showing {displayed.length} of {apps.length} applications</span>
        </div>

        <ErrorBox error={err} onRetry={() => load({ q })} />
        {loading ? (
          <TableSkeleton rows={7} />
        ) : displayed.length === 0 ? (
          <Empty
            icon={Users}
            title={filtered ? 'No applications match' : 'No applications yet'}
            action={
              filtered && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
                  Clear search & filters
                </button>
              )
            }
          >
            {filtered
              ? 'Try a different search term, department, job or stage.'
              : 'Candidates who apply on the public Careers site appear here automatically.'}
          </Empty>
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Applicant</th><th>Job Code</th><th>Designation</th><th className="num">Exp</th>
                  <th>Stage</th><th>Panel Score</th><th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <b>{a.candidate_name}</b>
                      <div className="mini">{fmtDate(a.applied_on)} · {a.source || '—'}</div>
                      <div className="mini font-mono">{a.reference_id}</div>
                    </td>
                    <td className="pcn">{a.job_code}</td>
                    <td>
                      {a.designation}
                      <div className="mini">{a.department}{a.grade ? ` · ${a.grade}` : ''}</div>
                    </td>
                    <td className="num">{a.total_experience_years ?? '—'}y</td>
                    <td>
                      <StageBadge stage={a.stage} />
                      {a.stage === 'Rejected' && a.rejection_reason && <div className="mini">{a.rejection_reason}</div>}
                      {a.stage === 'Interview Scheduled' && a.interview_date && <div className="mini">{a.interview_date}</div>}
                      {a.stage === 'Selected' && a.pcn && <div className="mini font-mono">{a.pcn}</div>}
                    </td>
                    <td><ScoreCell summary={a.score_summary} /></td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => setOpenId(a.id)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && (
        <ApplicantDrawer
          applicationId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => load({ q })}
        />
      )}
    </div>
  );
}
