import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, isCommitteeGrade } from '../lib/format';
import {
  btnGhost,
  btnPrimary,
  btnSm,
  EmptyState,
  ErrorBox,
  PageHeader,
  Skeleton,
  StageBadge,
} from '../components/ui';
import { IconCalendar, IconClipboardList, IconLock, IconUsers } from '../components/Icons';

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'scored', label: 'Scored' },
  { key: 'all', label: 'All' },
];

const selectCls =
  'px-3 py-2 min-h-[40px] border border-line rounded-sm text-[16px] sm:text-[13px] bg-beige/40 text-ink '
  + 'transition-colors duration-150 focus:border-berry cursor-pointer max-w-full';

/* interview_date is a free-text field in the HR panel ("e.g. 02 Jul 2026, 11:00 AM"),
   so it arrives in whatever shape HR typed. Only values that resolve to a real date
   become month/date options — anything else still shows on its card, it just can't
   be filtered on. */
function parsedDate(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  // Numeric forms are handled before falling back to the engine: it reads
  // YYYY-MM-DD as UTC midnight (which lands on the previous day west of GMT) and
  // doesn't understand DD/MM/YYYY at all — the form HR is most likely to type.
  // Day-first, per the en-IN convention used everywhere else in these panels.
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return ymd(iso[1], iso[2], iso[3]);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return ymd(dmy[3], dmy[2], dmy[1]);
  const d = new Date(s); // "17 Aug 2026", "02 Jul 2026, 11:00 AM", …
  return Number.isNaN(d.getTime()) ? null : d;
}
function ymd(year, month, day) {
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(Number(year), m - 1, d);
}
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const dayKey = (d) => `${monthKey(d)}-${pad(d.getDate())}`;
const monthLabel = (d) => d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

// Distinct values, sorted, ready for a <select>.
const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

function SkeletonCard() {
  return (
    <div className="bg-card border border-line rounded-sm p-5 mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-6 w-48 max-w-full" />
        <Skeleton className="h-3.5 w-72 max-w-full mt-2.5" />
        <Skeleton className="h-3.5 w-56 max-w-full mt-2" />
      </div>
      <Skeleton className="h-10 w-44" />
    </div>
  );
}

export default function Assignments() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [dept, setDept] = useState('');
  const [job, setJob] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api('/interviewer/assignments')
      .then((d) => alive && setAssignments(d.assignments || []))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const all = assignments || [];
  const anyFilter = Boolean(dept || job || month || day);

  /* Department / job / month / date narrow the queue; the Pending-Scored chips then
     work inside that selection, so their counts describe what you are looking at. */
  const scoped = useMemo(() => all.filter((a) => {
    if (dept && a.department !== dept) return false;
    if (job && a.designation !== job) return false;
    if (month || day) {
      const d = parsedDate(a.interview_date);
      if (!d) return false;
      if (month && monthKey(d) !== month) return false;
      if (day && dayKey(d) !== day) return false;
    }
    return true;
  }), [assignments, dept, job, month, day]);

  /* Job options follow the chosen department and dates follow the chosen month, so
     the dropdowns never offer a combination that returns nothing. Departments and
     months stay complete — they are the two axes people switch between most. */
  const options = useMemo(() => {
    const inDept = dept ? all.filter((a) => a.department === dept) : all;
    const dated = all.map((a) => parsedDate(a.interview_date)).filter(Boolean);
    const inMonth = month ? dated.filter((d) => monthKey(d) === month) : dated;
    const byKey = (entries) => [...new Map(entries).entries()].sort((x, y) => x[0].localeCompare(y[0]));
    return {
      departments: uniqueSorted(all.map((a) => a.department)),
      jobs: uniqueSorted(inDept.map((a) => a.designation)),
      months: byKey(dated.map((d) => [monthKey(d), monthLabel(d)])),
      days: byKey(inMonth.map((d) => [dayKey(d), formatDate(d)])),
    };
  }, [assignments, dept, month]);

  const counts = useMemo(() => {
    const scored = scoped.filter((a) => a.status === 'Scored').length;
    return { pending: scoped.length - scored, scored, all: scoped.length };
  }, [scoped]);

  const visible = useMemo(() => {
    if (filter === 'pending') return scoped.filter((a) => a.status !== 'Scored');
    if (filter === 'scored') return scoped.filter((a) => a.status === 'Scored');
    return scoped;
  }, [scoped, filter]);

  function clearFilters() {
    setDept('');
    setJob('');
    setMonth('');
    setDay('');
  }

  /* One interviewer can hold more than one round on the same candidate — the panel
     sheet deliberately puts the same person in rounds 1 and 3 — and the API returns
     one row per round. Group them onto a single card so a candidate appears once,
     with each of my panels listed on it. */
  const groups = useMemo(() => {
    const byApp = new Map();
    for (const a of visible) {
      const key = String(a.application_id);
      if (!byApp.has(key)) byApp.set(key, { key, candidate: a, rounds: [] });
      byApp.get(key).rounds.push(a);
    }
    for (const g of byApp.values()) g.rounds.sort((x, y) => x.round - y.round);
    return [...byApp.values()];
  }, [visible]);

  function retry() {
    setError('');
    setAssignments(null);
    setReloadKey((k) => k + 1);
  }

  return (
    <>
      <PageHeader
        title="My Assignments"
        sub="You only see candidates HR has assigned to you. Score each one independently — panels are compared, not merged."
      />

      {error && <ErrorBox onRetry={retry}>{error}</ErrorBox>}

      {!error && assignments === null && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {assignments !== null && all.length === 0 && (
        <EmptyState
          icon={<IconClipboardList size={22} />}
          title="No candidates assigned yet"
        >
          HR appoints interview panels from the Recruitment Panel — your assignments will appear
          here once you are named to one.
        </EmptyState>
      )}

      {assignments !== null && all.length > 0 && (
        <>
          <div className="flex items-end gap-2 flex-wrap mb-3">
            <label className="flex flex-col gap-1">
              <span className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted">
                Department
              </span>
              <select
                className={selectCls}
                value={dept}
                onChange={(e) => { setDept(e.target.value); setJob(''); }}
              >
                <option value="">All departments</option>
                {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted">
                Job
              </span>
              <select className={selectCls} value={job} onChange={(e) => setJob(e.target.value)}>
                <option value="">All jobs</option>
                {options.jobs.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted">
                Month
              </span>
              <select
                className={selectCls}
                value={month}
                onChange={(e) => { setMonth(e.target.value); setDay(''); }}
              >
                <option value="">All months</option>
                {options.months.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted">
                Interview date
              </span>
              <select className={selectCls} value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">All dates</option>
                {options.days.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>

            {anyFilter && (
              <button className={`${btnGhost} ${btnSm} min-h-[40px]`} onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter assignments">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    aria-pressed={active}
                    onClick={() => setFilter(f.key)}
                    className={`font-button text-[11px] font-medium uppercase tracking-[1.5px] px-3.5 min-h-[40px] rounded-sm border cursor-pointer transition duration-150 ease-out active:scale-[0.98] ${
                      active
                        ? 'bg-berry-soft text-berry border-berry'
                        : 'bg-transparent text-muted border-line hover:text-berry hover:border-berry'
                    }`}
                  >
                    {f.label} <span className="tabular-nums">({counts[f.key]})</span>
                  </button>
                );
              })}
            </div>
            <span className="text-[11.5px] text-muted tabular-nums">
              Showing {groups.length} candidate{groups.length === 1 ? '' : 's'} · {visible.length} of{' '}
              {counts.all} panel{counts.all === 1 ? '' : 's'}
              {anyFilter && ` (filtered from ${all.length})`}
            </span>
          </div>

          {visible.length === 0 && scoped.length === 0 && (
            <EmptyState
              icon={<IconClipboardList size={22} />}
              title="No assignments match these filters"
              action={
                <button className={`${btnGhost} ${btnSm}`} onClick={clearFilters}>
                  Clear filters
                </button>
              }
            >
              Nothing in your queue matches that combination — try widening the department,
              job or date.
            </EmptyState>
          )}

          {visible.length === 0 && scoped.length > 0 && (
            <EmptyState
              icon={<IconClipboardList size={22} />}
              title={filter === 'pending' ? 'Nothing pending' : 'Nothing scored yet'}
              action={
                <button className={`${btnGhost} ${btnSm}`} onClick={() => setFilter('all')}>
                  Show all assignments
                </button>
              }
            >
              {filter === 'pending'
                ? 'Every assigned candidate has been scored — well done.'
                : 'Scores you submit will appear under this filter.'}
            </EmptyState>
          )}

          {groups.map((g, i) => {
            const a = g.candidate;
            const scheduled = a.stage === 'Interview Scheduled';
            const multi = g.rounds.length > 1;
            // Panels run in order — a round waits until the earlier panels are in.
            const stateOf = (r) => {
              if (r.status === 'Scored') return 'scored';
              if (r.unlocked === false) return 'waiting';
              return scheduled ? 'ready' : 'unscheduled';
            };
            const blockers = (r) => (r.blocked_by?.length ? r.blocked_by : [r.round - 1]);
            const blockedText = (r) => {
              const b = blockers(r);
              return `panel${b.length > 1 ? 's' : ''} ${b.join(', ')}`;
            };
            const actionable = g.rounds.filter((r) => stateOf(r) !== 'unscheduled');
            const anyUnscheduled = g.rounds.some((r) => stateOf(r) === 'unscheduled');
            const open = (r) => navigate(`/score/${a.application_id}?round=${r.round}`);
            return (
              <div
                key={g.key}
                className="bg-card border border-line rounded-sm p-5 mb-3 flex flex-wrap items-center justify-between gap-3 rise-in"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-display text-xl font-semibold text-ink leading-tight">
                      {a.candidate_name}
                    </h2>
                    <StageBadge stage={a.stage} />
                  </div>
                  <div className="font-button text-[11px] uppercase tracking-[1.5px] text-muted mt-1.5">
                    {a.designation} ·{' '}
                    <span className="font-mono font-bold text-berry">{a.job_code}</span> · Grade{' '}
                    {a.grade} · {a.department}
                    {isCommitteeGrade(a.grade) && (
                      <span className="text-brand-amber font-semibold"> · 3 interview panels</span>
                    )}
                  </div>
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap font-button text-[11px] uppercase tracking-[1.5px] text-muted mt-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <IconCalendar size={14} className="shrink-0" />
                      Interview:{' '}
                      <b className="text-ink font-semibold">{formatDate(a.interview_date)}</b>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <IconUsers size={14} className="shrink-0" />
                      My panel{multi ? 's' : ''}:{' '}
                      <b className="text-ink font-semibold">
                        {g.rounds.map((r) => r.panel_role).join(', ')}
                      </b>
                    </span>
                    {!multi && stateOf(g.rounds[0]) === 'waiting' && (
                      <span className="text-brand-amber font-semibold">
                        Waiting for {blockedText(g.rounds[0])}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-stretch gap-1.5">
                  {actionable.map((r) => {
                    const state = stateOf(r);
                    if (state === 'scored') {
                      return (
                        <button key={r.id} className={`${btnGhost} ${btnSm}`} onClick={() => open(r)}>
                          {multi ? `Review panel ${r.round}` : 'Review / edit my score'}
                        </button>
                      );
                    }
                    if (state === 'waiting') {
                      return (
                        <button
                          key={r.id}
                          className={`${btnGhost} ${btnSm}`}
                          disabled
                          title={`Panel ${r.round} opens once ${blockedText(r)} ${blockers(r).length > 1 ? 'have' : 'has'} been scored`}
                        >
                          Panel {r.round} locked
                        </button>
                      );
                    }
                    return (
                      <button key={r.id} className={`${btnPrimary} ${btnSm}`} onClick={() => open(r)}>
                        {multi ? `Score panel ${r.round}` : 'Score candidate'}
                      </button>
                    );
                  })}
                  {anyUnscheduled && (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                      <IconLock size={14} className="shrink-0" />
                      Scoring unlocks when HR schedules the interview
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
