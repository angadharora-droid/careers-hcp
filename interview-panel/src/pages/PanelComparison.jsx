import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { isCommitteeGrade } from '../lib/format';
import {
  EmptyState,
  ErrorBox,
  Field,
  inputCls,
  PageHeader,
  RecChip,
  SECTIONS,
  Skeleton,
  tdCls,
  thCls,
} from '../components/ui';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconFlag,
  IconUsers,
} from '../components/Icons';

function PanellistRow({ score }) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(0, Math.min(100, Number(score.total_score) || 0));
  const flagCount = score.red_flags ? score.red_flags.length : 0;

  return (
    <div className="border border-line rounded-sm mb-2 overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[52px] text-left cursor-pointer hover:bg-beige/40 transition-colors duration-150"
      >
        <span className="min-w-0 sm:w-56 shrink-0 block">
          <span className="block text-[13px] font-semibold text-ink truncate">
            {score.panelist_name}
          </span>
          <span className="block font-button text-[11px] uppercase tracking-[1.5px] text-muted">
            {score.panel_role}
          </span>
        </span>
        <span className="flex-1 hidden sm:block" aria-hidden="true">
          <span className="block h-1.5 bg-beige rounded-full overflow-hidden">
            <span
              className="block h-full bg-berry rounded-full"
              style={{ width: `${pct}%` }}
            />
          </span>
        </span>
        {flagCount > 0 && (
          <span className="inline-flex items-center gap-1 text-brand-red font-button text-[11px] font-semibold uppercase tracking-[1.5px] shrink-0 tabular-nums">
            <IconFlag size={13} /> {flagCount}
          </span>
        )}
        <span className="shrink-0 tabular-nums text-right">
          <b className="text-ink text-[15px]">{score.total_score}</b>
          <span className="text-muted text-xs">/100</span>
        </span>
        <IconChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="rise-in border-t border-line px-3.5 py-3 bg-cream/40">
          {flagCount > 0 && (
            <div className="flex items-start gap-2 text-xs text-brand-red mb-2.5">
              <IconFlag size={14} className="mt-0.5 shrink-0" />
              <span>
                <b>Red flags:</b> {score.red_flags.join(', ')}
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px] bg-card">
              <thead>
                <tr>
                  <th className={thCls}>Competency</th>
                  <th className={thCls}>Section</th>
                  <th className={thCls}>Level</th>
                  <th className={`${thCls} text-right`}>Points</th>
                </tr>
              </thead>
              <tbody>
                {(score.competency_breakdown || []).map((b) => (
                  <tr
                    key={b.competency_key}
                    className="even:bg-cream/50 hover:bg-beige/40 transition-colors duration-150"
                  >
                    <td className={tdCls}>{b.name}</td>
                    <td className={tdCls}>{SECTIONS[b.section]?.name || b.section}</td>
                    <td className={tdCls}>{b.level_label}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>
                      <b>{b.points}</b>
                      <span className="text-muted">/{b.weight}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(score.evidence_notes || score.strengths || score.concerns) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {score.evidence_notes && (
                <Field
                  label="Evidence observed"
                  value={score.evidence_notes}
                  className="sm:col-span-2"
                />
              )}
              {score.strengths && <Field label="Key strengths" value={score.strengths} />}
              {score.concerns && <Field label="Concerns" value={score.concerns} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PanelComparison() {
  const [assignments, setAssignments] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [scores, setScores] = useState(null);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresError, setScoresError] = useState('');
  const [scoresReloadKey, setScoresReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api('/interviewer/assignments')
      .then((d) => {
        if (!alive) return;
        // one entry per application (server returns one row per assignment to me)
        const seen = new Set();
        const unique = (d.assignments || []).filter((a) => {
          if (seen.has(a.application_id)) return false;
          seen.add(a.application_id);
          return true;
        });
        setAssignments(unique);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedId) {
      setScores(null);
      setScoresError('');
      return undefined;
    }
    let alive = true;
    setScoresLoading(true);
    setScoresError('');
    setScores(null);
    api(`/applications/${selectedId}/scores`)
      .then((d) => alive && setScores(d))
      .catch((e) => alive && setScoresError(e.message))
      .finally(() => alive && setScoresLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedId, scoresReloadKey]);

  const summary = scores?.summary;
  const rows = scores?.scores || [];

  return (
    <>
      <PageHeader
        title="Panel Comparison"
        sub="Each panellist's submitted score, side by side. Divergence above 15 points means the panel saw the candidate differently — discuss before deciding, don't average. You only see candidates you are assigned to."
      />

      {error && (
        <ErrorBox
          onRetry={() => {
            setError('');
            setAssignments(null);
            setReloadKey((k) => k + 1);
          }}
        >
          {error}
        </ErrorBox>
      )}

      {!error && assignments === null && (
        <div className="bg-card border border-line rounded-sm p-5 mb-4">
          <Skeleton className="h-3.5 w-24 mb-2" />
          <Skeleton className="h-11 w-full sm:max-w-md" />
        </div>
      )}

      {assignments !== null && assignments.length === 0 && (
        <EmptyState icon={<IconUsers size={22} />} title="No candidates assigned yet">
          HR appoints panels from the Recruitment Panel — comparisons appear here once you have
          assignments.
        </EmptyState>
      )}

      {assignments !== null && assignments.length > 0 && (
        <div className="bg-card border border-line rounded-sm p-5 mb-4">
          <label
            className="block font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted mb-1"
            htmlFor="cmp-candidate"
          >
            Candidate
          </label>
          <div className="relative sm:max-w-md">
            <select
              id="cmp-candidate"
              className={`${inputCls} appearance-none pr-10 cursor-pointer`}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— Select a candidate —</option>
              {assignments.map((a) => (
                <option key={a.application_id} value={a.application_id}>
                  {a.candidate_name} — {a.designation} ·{' '}
                  {a.status === 'Scored' ? 'Scored by me' : 'Pending my score'}
                </option>
              ))}
            </select>
            <IconChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>

          <div className="mt-4">
            {scoresLoading && (
              <>
                <Skeleton className="h-6 w-64 max-w-full mb-3" />
                <Skeleton className="h-[52px] w-full mb-2" />
                <Skeleton className="h-[52px] w-full" />
              </>
            )}
            {scoresError && (
              <ErrorBox onRetry={() => setScoresReloadKey((k) => k + 1)}>{scoresError}</ErrorBox>
            )}

            {scores && summary && rows.length === 0 && (
              <EmptyState icon={<IconUsers size={22} />} title="No scores submitted yet">
                Panellists' scores appear here as each one submits — score yours from My
                Assignments.
              </EmptyState>
            )}

            {scores && summary && rows.length > 0 && (
              <div className="rise-in">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-line pb-2.5 mb-3">
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {scores.candidate_name}{' '}
                    <span className="font-sans text-[11.5px] text-muted font-normal">
                      · {scores.designation}
                      {isCommitteeGrade(scores.grade) ? ' · 3-member committee' : ''}
                    </span>
                  </h2>
                  {summary.count >= 2 &&
                    (summary.diverged ? (
                      <span className="inline-flex items-center gap-1 font-button text-[11px] font-semibold uppercase tracking-[1.5px] px-2 py-0.5 rounded-sm bg-[#fbe9e7] text-brand-red tabular-nums">
                        <IconAlertTriangle size={12} /> Diverged {summary.spread} pts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-button text-[11px] font-semibold uppercase tracking-[1.5px] px-2 py-0.5 rounded-sm bg-[#e8f4ec] text-brand-green">
                        Aligned
                      </span>
                    ))}
                </div>

                {rows.map((s, i) => (
                  <PanellistRow key={`${s.panelist_name}-${i}`} score={s} />
                ))}

                <div className="mt-3 flex items-center gap-2 flex-wrap text-[12.5px]">
                  <span className="font-button text-[11px] uppercase tracking-[1.5px] text-muted">
                    Panel average
                  </span>
                  <b className="font-display text-2xl font-semibold text-berry leading-none tabular-nums">
                    {summary.average}
                  </b>
                  <span className="text-muted">/100 ·</span>
                  <RecChip rec={summary.recommendation} />
                  <span className="text-muted tabular-nums">
                    · {summary.count}/{summary.needed} panellists in
                  </span>
                </div>

                {summary.diverged && (
                  <div
                    role="alert"
                    className="mt-3 flex items-start gap-2.5 bg-[#fbe9e7] border border-brand-red/40 rounded-sm px-4 py-3 text-[12.5px] text-brand-red"
                  >
                    <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <b>Diverged by {summary.spread} points — discuss, don't average.</b> The
                      panel saw this candidate differently; reconcile what one panellist saw that
                      the other did not before recommending.
                    </div>
                  </div>
                )}
                {summary.any_red_flags && (
                  <div
                    role="alert"
                    className="mt-2 flex items-start gap-2.5 bg-[#fbe9e7] border border-brand-red/40 rounded-sm px-4 py-3 text-[12.5px] text-brand-red"
                  >
                    <IconFlag size={15} className="mt-0.5 shrink-0" />
                    <div>
                      <b>Red flag raised</b> by at least one panellist — route to HR review
                      regardless of the numeric score.
                    </div>
                  </div>
                )}
                {summary.count < summary.needed && (
                  <div className="text-[11.5px] text-muted mt-2 tabular-nums">
                    Waiting on {summary.needed - summary.count} more panellist
                    {summary.needed - summary.count === 1 ? '' : 's'}.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
