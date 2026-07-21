import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { inr } from '../lib/format';
import { exportCSV, stamp } from '../lib/export';
import { ErrorBox, Empty, TableSkeleton } from '../components/LoadState';
import { StatusPill, FlagPill } from '../components/Badges';
import PositionModal from '../components/PositionModal';
import PageHeader from '../components/PageHeader';
import { Plus, Search, X, ArrowUpDown, ChevronUp, ChevronDown, Edit, Table, Download } from '../components/Icons';

const STATUSES = ['Vacant', 'Filled', 'Under Recruitment', 'Frozen', 'On Hold', 'Contract', 'Outsourced', 'Eliminated'];

// CSV columns for the register export (mirrors the filtered/sorted table on screen).
const POS_CSV = [
  { header: 'Job Code', value: (p) => p.job_code },
  { header: 'PCN', value: (p) => p.pcn },
  { header: 'Designation', value: (p) => p.designation },
  { header: 'Job Family', value: (p) => p.job_family || '' },
  { header: 'Grade', value: (p) => p.grade },
  { header: 'Department', value: (p) => p.department },
  { header: 'Reports To', value: (p) => p.reports_to || '' },
  { header: 'Budget (monthly)', value: (p) => p.budgeted_salary ?? '' },
  { header: 'Salary Min', value: (p) => p.salary_min ?? '' },
  { header: 'Salary Max', value: (p) => p.salary_max ?? '' },
  { header: 'Status', value: (p) => p.status },
  { header: 'Days Vacant', value: (p) => p.days_vacant ?? '' },
  { header: 'SLA Breached', value: (p) => (p.sla_breached ? 'Yes' : 'No') },
  { header: 'Occupant', value: (p) => p.occupant_name || '' },
  { header: 'Critical', value: (p) => (p.is_critical ? 'Yes' : 'No') },
  { header: 'Revenue Generating', value: (p) => (p.is_revenue_generating ? 'Yes' : 'No') },
  { header: 'Guest Facing', value: (p) => (p.is_guest_facing ? 'Yes' : 'No') },
];

// Client-side sortable columns
const SORTS = {
  designation: { label: 'Designation', get: (p) => p.designation || '', string: true },
  budget: { label: 'Budget', get: (p) => Number(p.budgeted_salary) || 0 },
  days: { label: 'Days Vacant', get: (p) => (p.days_vacant == null ? null : Number(p.days_vacant)) },
};

function SortHeader({ id, children, sort, onSort, className = '' }) {
  const active = sort.key === id;
  const IconCmp = !active ? ArrowUpDown : sort.dir === 1 ? ChevronUp : ChevronDown;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 uppercase tracking-[1.5px] font-medium cursor-pointer hover:text-berry transition-colors duration-150"
        onClick={() => onSort(id)}
      >
        {children}
        <IconCmp size={12} className={active ? 'text-berry' : 'text-muted/70'} />
      </button>
    </th>
  );
}

function FilterChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 bg-berry-soft text-berry border border-berry/30 rounded-sm pl-2 pr-1 py-0.5 text-[11px] font-semibold uppercase tracking-[1px]">
      {label}
      <button
        type="button"
        aria-label={`Clear filter: ${label}`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-sm cursor-pointer hover:bg-berry hover:text-white transition-colors duration-150"
        onClick={onClear}
      >
        <X size={11} />
      </button>
    </span>
  );
}

export default function RegisterPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [positions, setPositions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [depts, setDepts] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [grade, setGrade] = useState('');
  // Dashboard KPI drill-downs land here: /register?status=Vacant · /register?breached=1
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [breachedOnly, setBreachedOnly] = useState(() => searchParams.get('breached') === '1');

  const [sort, setSort] = useState({ key: null, dir: 1 });

  // null = closed, 'new' = add, object = edit
  const [modal, setModal] = useState(null);

  const debounce = useRef(null);

  // Consume the query params once so refresh/back doesn't re-pin the filter.
  useEffect(() => {
    if (searchParams.get('status') || searchParams.get('breached')) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFiltered = useCallback(async (filters) => {
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.dept) params.set('dept', filters.dept);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.status) params.set('status', filters.status);
      const qs = params.toString();
      const d = await api.get(`/positions${qs ? `?${qs}` : ''}`);
      setPositions(d.positions || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Department options + total count come from an unfiltered read.
  const loadMeta = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([api.get('/positions'), api.get('/grades')]);
      setTotalCount((p.positions || []).length);
      setDepts([...new Set((p.positions || []).map((x) => x.department))].sort());
      setGrades(g.grades || []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => loadFiltered({ q, dept, grade, status }), q ? 250 : 0);
    return () => clearTimeout(debounce.current);
  }, [q, dept, grade, status, loadFiltered]);

  function afterWrite() {
    setModal(null);
    loadFiltered({ q, dept, grade, status });
    loadMeta();
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  }

  const displayed = useMemo(() => {
    let rows = breachedOnly ? positions.filter((p) => p.sla_breached) : positions;
    if (sort.key) {
      const { get, string } = SORTS[sort.key];
      rows = [...rows].sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1; // nulls last regardless of direction
        if (vb == null) return -1;
        const cmp = string ? String(va).localeCompare(String(vb)) : va - vb;
        return cmp * sort.dir;
      });
    }
    return rows;
  }, [positions, breachedOnly, sort]);

  const anyFilter = q || dept || grade || status || breachedOnly;

  return (
    <div>
      <PageHeader
        title="Position Control Register"
        sub="Sanctioned seats · recruitment opens only against approved vacancies"
        action={
          <button type="button" className="btn" onClick={() => setModal('new')}>
            <Plus size={14} />
            Add Position
          </button>
        }
      />

      <div className="card">
        <div className="infobar">
          <b>Positions exist independently of employees.</b> Recruitment can only open against a position that is Approved + Vacant + within budget. Employees occupy PCNs; they don't create them.
        </div>

        <div className="flex gap-2 flex-wrap items-center mb-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              className="inp w-auto min-w-[210px] pl-8"
              placeholder="Search PCN / designation…"
              aria-label="Search positions"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="inp w-auto min-w-[150px]" aria-label="Filter by department" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select className="inp w-auto min-w-[110px]" aria-label="Filter by grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">All grades</option>
            {grades.map((g) => <option key={g.code} value={g.code}>{g.code}</option>)}
          </select>
          <select className="inp w-auto min-w-[130px]" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm ml-auto"
            onClick={() => exportCSV(`positions-${status ? status.replace(/\s+/g, '-').toLowerCase() + '-' : ''}${stamp()}.csv`, POS_CSV, displayed)}
            disabled={displayed.length === 0}
            title="Download the positions shown below as a CSV spreadsheet"
          >
            <Download size={13} />
            Export CSV
          </button>
          <span className="mini tabular-nums">Showing {displayed.length} of {totalCount} positions</span>
        </div>

        {anyFilter && (
          <div className="flex gap-1.5 flex-wrap items-center mb-3">
            {q && <FilterChip label={`Search: ${q}`} onClear={() => setQ('')} />}
            {dept && <FilterChip label={dept} onClear={() => setDept('')} />}
            {grade && <FilterChip label={`Grade ${grade}`} onClear={() => setGrade('')} />}
            {status && <FilterChip label={status} onClear={() => setStatus('')} />}
            {breachedOnly && <FilterChip label="Past SLA only" onClear={() => setBreachedOnly(false)} />}
          </div>
        )}

        <ErrorBox error={err} onRetry={() => { loadMeta(); loadFiltered({ q, dept, grade, status }); }} />
        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Job Code</th><th>PCN (seat)</th>
                  <SortHeader id="designation" sort={sort} onSort={toggleSort}>Designation</SortHeader>
                  <th>Job Family</th><th>Grade</th>
                  <th>Dept</th><th>Reports To</th>
                  <SortHeader id="budget" sort={sort} onSort={toggleSort} className="num">Budget ₹/mo</SortHeader>
                  <th>Status</th>
                  <SortHeader id="days" sort={sort} onSort={toggleSort} className="num">Days Vacant</SortHeader>
                  <th>Occupant</th><th>Flags</th><th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={13}>
                      <Empty
                        icon={Table}
                        title={anyFilter ? 'No positions match' : 'No positions yet'}
                        action={
                          anyFilter ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => { setQ(''); setDept(''); setGrade(''); setStatus(''); setBreachedOnly(false); }}
                            >
                              Clear all filters
                            </button>
                          ) : (
                            <button type="button" className="btn btn-sm" onClick={() => setModal('new')}>
                              <Plus size={13} />
                              Add Position
                            </button>
                          )
                        }
                      >
                        {anyFilter
                          ? 'Try widening the search or clearing a filter chip above.'
                          : 'Create the first sanctioned position to open the register.'}
                      </Empty>
                    </td>
                  </tr>
                ) : (
                  displayed.map((p) => (
                    <tr key={p.id}>
                      <td className="pcn text-ink">{p.job_code}</td>
                      <td className="pcn">{p.pcn}</td>
                      <td>{p.designation}</td>
                      <td>{p.job_family || '—'}</td>
                      <td>{p.grade}</td>
                      <td>{p.department}</td>
                      <td>{p.reports_to || '—'}</td>
                      <td className="num">{inr(p.budgeted_salary)}</td>
                      <td><StatusPill status={p.status} /></td>
                      <td className="num">
                        {p.days_vacant == null ? (
                          <span className="mini">—</span>
                        ) : (
                          <>
                            <span className={`font-bold ${p.sla_breached ? 'text-brand-red' : 'text-ink'}`}>{p.days_vacant}d</span>
                            {p.sla_breached && <span className="mini text-brand-red font-bold"> &gt;SLA</span>}
                          </>
                        )}
                      </td>
                      <td>{p.occupant_name || <span className="mini">vacant</span>}</td>
                      <td>
                        <span className="flex gap-1 flex-wrap">
                          {p.is_critical && <FlagPill tone="amber">Critical</FlagPill>}
                          {p.is_revenue_generating && <FlagPill>Rev</FlagPill>}
                          {p.is_guest_facing && <FlagPill>Guest</FlagPill>}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal(p)}>
                          <Edit size={13} />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <PositionModal
          position={modal === 'new' ? null : modal}
          grades={grades}
          onClose={() => setModal(null)}
          onSaved={afterWrite}
        />
      )}
    </div>
  );
}
