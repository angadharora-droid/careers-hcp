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

  const counts = useMemo(() => {
    const list = assignments || [];
    const scored = list.filter((a) => a.status === 'Scored').length;
    return { pending: list.length - scored, scored, all: list.length };
  }, [assignments]);

  const visible = useMemo(() => {
    const list = assignments || [];
    if (filter === 'pending') return list.filter((a) => a.status !== 'Scored');
    if (filter === 'scored') return list.filter((a) => a.status === 'Scored');
    return list;
  }, [assignments, filter]);

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

      {assignments !== null && counts.all === 0 && (
        <EmptyState
          icon={<IconClipboardList size={22} />}
          title="No candidates assigned yet"
        >
          HR appoints interview panels from the Recruitment Panel — your assignments will appear
          here once you are named to one.
        </EmptyState>
      )}

      {assignments !== null && counts.all > 0 && (
        <>
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
            </span>
          </div>

          {visible.length === 0 && (
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
