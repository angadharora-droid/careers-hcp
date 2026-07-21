import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, downloadDocument } from '../lib/api';
import { formatDate, recommendationFor } from '../lib/format';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  btnGhost,
  btnGreen,
  btnSm,
  Card,
  ErrorBox,
  Field,
  InfoBanner,
  labelCls,
  RecChip,
  SECTIONS,
  Skeleton,
  StageBadge,
  textareaCls,
} from '../components/ui';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheckCircle,
  IconChevronDown,
  IconDownload,
  IconFileText,
  IconLoader,
} from '../components/Icons';

const RED_FLAGS = [
  { value: 'Poor Grooming', label: 'Poor Grooming' },
  { value: 'Dishonesty', label: 'Dishonesty / Integrity' },
  { value: 'Poor Communication', label: 'Poor Communication' },
  { value: 'Negative Attitude', label: 'Negative Attitude' },
  { value: 'Frequent Job Changes', label: 'Frequent Job Changes' },
  { value: 'Cultural Misfit', label: 'Cultural Misfit' },
];

const SECTION_ORDER = ['att', 'skill', 'know'];

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function CompetencyBlock({ comp, levels, selected, onPick, department, registerRef }) {
  return (
    <div
      ref={(el) => registerRef(comp.key, el)}
      tabIndex={-1}
      className="border border-line rounded-sm mb-3 overflow-hidden scroll-mt-24"
    >
      <div className="bg-beige/50 px-3 py-2 flex items-center justify-between gap-2 border-b border-line">
        <h3 className="font-semibold text-[13px] text-ink">{comp.name}</h3>
        <span className="flex items-center gap-1.5 shrink-0">
          {selected !== undefined && (
            <IconCheckCircle size={14} className="text-brand-green" />
          )}
          <span className="text-[11px] text-berry font-bold bg-berry-soft px-2 py-0.5 rounded-sm tabular-nums">
            {comp.weight}%
          </span>
        </span>
      </div>
      <div className="px-3 pt-1.5 pb-3">
        {comp.is_placeholder && (
          <div className="bg-beige/40 border border-dashed border-brand-amber rounded-sm px-3 py-2 text-[11.5px] text-brand-amber my-1.5 flex items-start gap-2">
            <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Placeholder content — the {department} HOD must replace these anchors with real
              trade-specific behaviours before this role goes live.
            </span>
          </div>
        )}
        {(comp.anchors || []).map((anchor, li) => {
          const isSel = selected === li;
          const level = levels[li] || {};
          return (
            <label
              key={li}
              className={`anchor-row group flex flex-wrap sm:flex-nowrap items-start gap-2.5 px-3 py-2.5 mt-1 min-h-[44px] rounded-sm cursor-pointer border transition-colors duration-150 ${
                isSel ? 'bg-berry-soft border-berry' : 'border-transparent hover:bg-beige/40'
              }`}
            >
              {/* Real radio, visually hidden — keyboard arrow-group nav stays native. */}
              <input
                type="radio"
                className="sr-only"
                name={`comp_${comp.key}`}
                checked={isSel}
                onChange={() => onPick(comp.key, li)}
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-150 ${
                  isSel ? 'border-berry' : 'border-muted/60 group-hover:border-berry'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full transition-colors duration-150 ${
                    isSel ? 'bg-berry' : 'bg-transparent'
                  }`}
                />
              </span>
              <span className="font-bold text-xs text-ink sm:min-w-[120px] shrink-0">
                {level.label}
              </span>
              <span className="text-xs text-body order-last sm:order-none basis-full sm:basis-auto sm:flex-1">
                {anchor}
              </span>
              <span className="text-[11px] text-muted font-bold ml-auto shrink-0 tabular-nums text-right min-w-[3ch]">
                {Math.round(comp.weight * (level.pct || 0))}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function ScoreCandidate() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [sel, setSel] = useState({}); // competency key -> level_index
  const [evidence, setEvidence] = useState('');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [flags, setFlags] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const blockRefs = useRef({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api(`/interviewer/applications/${applicationId}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        if (d.my_score) {
          const s = {};
          (d.my_score.competency_breakdown || []).forEach((b) => {
            s[b.competency_key] = b.level_index;
          });
          setSel(s);
          setEvidence(d.my_score.evidence_notes || '');
          setStrengths(d.my_score.strengths || '');
          setConcerns(d.my_score.concerns || '');
          setFlags(d.my_score.red_flags || []);
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [applicationId, reloadKey]);

  const comps = data?.competencies || [];
  const levels = data?.levels || [];

  const orderedComps = useMemo(
    () => SECTION_ORDER.flatMap((sec) => comps.filter((c) => c.section === sec)),
    [comps]
  );

  const { total, answered } = useMemo(() => {
    let raw = 0;
    let n = 0;
    comps.forEach((c) => {
      const li = sel[c.key];
      if (li !== undefined && levels[li]) {
        raw += c.weight * levels[li].pct;
        n += 1;
      }
    });
    return { total: Math.round(raw), answered: n };
  }, [comps, levels, sel]);

  const complete = comps.length > 0 && answered === comps.length;

  if (loading) {
    return (
      <>
        <Skeleton className="h-4 w-44 mb-4" />
        <div className="bg-card border border-line rounded-sm p-5 mb-4">
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-3.5 w-80 max-w-full mt-2.5" />
          <Skeleton className="h-3.5 w-64 max-w-full mt-2" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="bg-card border border-line rounded-sm p-5 mb-4">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-24 w-full mb-3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </>
    );
  }

  if (error) {
    return (
      <>
        <ErrorBox onRetry={() => setReloadKey((k) => k + 1)}>{error}</ErrorBox>
        <Link to="/" className={`${btnGhost} ${btnSm}`}>
          <IconArrowLeft size={14} />
          Back to My Assignments
        </Link>
      </>
    );
  }
  if (!data) return null;

  const app = data.application;
  const panel = data.panel || {};
  const stageLocked = app.stage !== 'Interview Scheduled';
  const editing = Boolean(data.my_score);
  const nothingToClear =
    answered === 0 && !evidence && !strengths && !concerns && flags.length === 0;

  function registerRef(key, el) {
    if (el) blockRefs.current[key] = el;
    else delete blockRefs.current[key];
  }

  function scrollToBlock(key, { focus = false, forceScroll = false } = {}) {
    const el = blockRefs.current[key];
    if (!el) return;
    const reduced = prefersReducedMotion();
    if (!reduced || forceScroll) {
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    }
    if (focus) el.focus({ preventScroll: true });
  }

  function pick(key, levelIndex) {
    const firstPick = sel[key] === undefined;
    const next = { ...sel, [key]: levelIndex };
    setSel(next);
    // Only advance on the first pick for a competency, so keyboard users can
    // arrow between levels without the page jumping away.
    if (!firstPick) return;
    const idx = orderedComps.findIndex((c) => c.key === key);
    const target =
      orderedComps.slice(idx + 1).find((c) => next[c.key] === undefined) ||
      orderedComps.find((c) => next[c.key] === undefined);
    if (target) scrollToBlock(target.key);
  }

  function goToFirstUnscored() {
    const target = orderedComps.find((c) => sel[c.key] === undefined);
    if (target) scrollToBlock(target.key, { focus: true, forceScroll: true });
  }

  function toggleFlag(value) {
    setFlags((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  }

  function doClear() {
    setSel({});
    setEvidence('');
    setStrengths('');
    setConcerns('');
    setFlags([]);
    setSubmitError('');
    setConfirmClear(false);
    toast('Scorecard cleared — score every competency again');
  }

  async function handleDownload(doc) {
    try {
      await downloadDocument(doc.filename, doc.original_name);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function submit() {
    if (!complete) {
      goToFirstUnscored();
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api(`/interviewer/applications/${applicationId}/score`, {
        method: 'POST',
        body: {
          competency_selections: comps.map((c) => ({ key: c.key, level_index: sel[c.key] })),
          evidence_notes: evidence.trim(),
          strengths: strengths.trim(),
          concerns: concerns.trim(),
          red_flags: flags,
        },
      });
      const s = res?.score || {};
      toast(`Score submitted: ${s.total_score}/100 — ${s.recommendation}`);
      navigate('/');
    } catch (e) {
      setSubmitError(e.message);
      toast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const experience =
    app.total_experience_years === undefined ||
    app.total_experience_years === null ||
    app.total_experience_years === ''
      ? ''
      : `${app.total_experience_years} yrs`;

  const docCount = app.documents ? app.documents.length : 0;

  return (
    <>
      <div className="mb-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-button text-[11px] font-medium uppercase tracking-[2px] text-berry hover:underline"
        >
          <IconArrowLeft size={14} />
          Back to My Assignments
        </Link>
      </div>

      {/* Candidate header — compact, with a collapsible profile so the form leads. */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[26px] font-semibold text-ink leading-tight">
              {app.candidate_name}
            </h1>
            <div className="font-button text-[11px] uppercase tracking-[1.5px] text-muted mt-1.5">
              {app.designation} ·{' '}
              <span className="font-mono font-bold text-berry">{app.job_code}</span> · Grade{' '}
              {app.grade} · {app.department}
            </div>
          </div>
          <div className="text-left sm:text-right text-[12.5px]">
            <StageBadge stage={app.stage} />
            <div className="mt-1 text-muted">
              Interview: <b className="text-ink">{formatDate(app.interview_date)}</b>
            </div>
            <div className="text-muted">
              My role: <b className="text-ink">{panel.my_role}</b>
              {panel.committee ? ' · 3-member committee' : ' · 2-member panel'}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-line">
          <button
            type="button"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((v) => !v)}
            className="w-full min-h-[40px] flex items-center justify-between gap-2 font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted hover:text-berry cursor-pointer transition-colors duration-150"
          >
            <span>
              Candidate profile
              {docCount > 0 && (
                <span className="tabular-nums">
                  {' '}
                  · {docCount} document{docCount === 1 ? '' : 's'}
                </span>
              )}
            </span>
            <IconChevronDown
              size={16}
              className={`shrink-0 transition-transform duration-200 ${
                profileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {profileOpen && (
            <div className="rise-in pb-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                <Field
                  label="Age / Gender"
                  value={[app.age, app.gender].filter(Boolean).join(' / ')}
                />
                <Field label="Qualification" value={app.qualification} />
                <Field label="Total experience" value={experience} />
                <Field label="Current designation" value={app.current_designation} />
                <Field label="Years in current firm" value={app.years_in_current_firm} />
                <Field label="Job family" value={app.job_family} />
              </div>
              {(app.intro_note || app.why_join) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <Field label="Intro note" value={app.intro_note} />
                  <Field label="Why join Centre Point" value={app.why_join} />
                </div>
              )}
              <div className="mt-3">
                <div className="font-button text-[11px] uppercase tracking-[1.5px] text-muted font-medium mb-1.5">
                  Documents
                </div>
                {docCount > 0 ? (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {app.documents.map((doc) => (
                      <li key={doc.filename}>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="w-full flex items-center gap-2.5 border border-line rounded-sm px-3 py-2.5 min-h-[44px] text-[12.5px] text-body hover:border-berry hover:text-berry cursor-pointer transition duration-150 ease-out active:scale-[0.99]"
                        >
                          <IconFileText size={16} className="shrink-0 text-muted" />
                          <span className="flex-1 text-left truncate font-medium">
                            {doc.original_name || doc.filename}
                          </span>
                          <IconDownload size={16} className="shrink-0" />
                          <span className="sr-only">Download</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[13px] text-muted">No documents uploaded</div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <InfoBanner>
        <b>Score independently.</b> Note on paper first, then enter — don't anchor on other
        panellists.
      </InfoBanner>

      {stageLocked && (
        <ErrorBox>
          Scoring is locked — this application's stage is "{app.stage}". Scores can only be
          submitted while the stage is Interview Scheduled.
        </ErrorBox>
      )}

      {/* Scoring form — one card per section with live completion. */}
      {SECTION_ORDER.map((sec) => {
        const sectionComps = comps.filter((c) => c.section === sec);
        if (!sectionComps.length) return null;
        const done = sectionComps.filter((c) => sel[c.key] !== undefined).length;
        const sectionDone = done === sectionComps.length;
        const meta = SECTIONS[sec];
        return (
          <section key={sec} className="bg-card border border-line rounded-sm p-5 mb-4">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-line pb-2.5 mb-4">
              <h2 className="font-display text-lg font-semibold text-ink">
                {meta.name}{' '}
                <span className="text-muted font-normal text-base">
                  — {meta.weight} of total
                </span>
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 font-button text-[11px] font-medium uppercase tracking-[1.5px] tabular-nums ${
                  sectionDone ? 'text-brand-green' : 'text-muted'
                }`}
              >
                {sectionDone && <IconCheckCircle size={15} />}
                {done}/{sectionComps.length} scored
              </span>
            </div>
            {sectionComps.map((c) => (
              <CompetencyBlock
                key={c.key}
                comp={c}
                levels={levels}
                selected={sel[c.key]}
                onPick={pick}
                department={app.department}
                registerRef={registerRef}
              />
            ))}
          </section>
        );
      })}

      {/* Evidence & wrap */}
      <Card title="Evidence, Red Flags & Recommendation">
        <label className={labelCls} htmlFor="evidence">
          Evidence Observed (specific examples given by candidate)
        </label>
        <textarea
          id="evidence"
          className={textareaCls}
          placeholder="What did they actually say/do? Quote specifics, not impressions."
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className={labelCls} htmlFor="strengths">
              Key Strengths
            </label>
            <textarea
              id="strengths"
              className={textareaCls}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="concerns">
              Concerns / Development Areas
            </label>
            <textarea
              id="concerns"
              className={textareaCls}
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
            />
          </div>
        </div>
        <div className={labelCls}>Red Flags observed</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {RED_FLAGS.map((rf) => (
            <label
              key={rf.value}
              className="flex items-center gap-1.5 py-1.5 text-[12.5px] font-medium cursor-pointer"
            >
              <input
                type="checkbox"
                checked={flags.includes(rf.value)}
                onChange={() => toggleFlag(rf.value)}
                className="accent-berry"
              />
              {rf.label}
            </label>
          ))}
        </div>
        <div className="text-[11px] text-muted mt-2">
          Any red flag overrides the numeric score — surfaced to HR regardless of total.
        </div>
      </Card>

      {submitError && <ErrorBox>{submitError}</ErrorBox>}

      {/* Sticky progress bar */}
      <div className="sticky bottom-0 z-10 bg-card border-t border-line -mx-4 sm:-mx-6 -mb-4 px-4 sm:px-6 pt-3.5 pb-3">
        <div
          className="absolute top-0 left-0 right-0 h-[3px] bg-beige"
          role="progressbar"
          aria-label="Scoring progress"
          aria-valuemin={0}
          aria-valuemax={comps.length}
          aria-valuenow={answered}
        >
          <div
            className="h-full bg-berry origin-left transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${comps.length ? answered / comps.length : 0})` }}
          />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
          <div>
            <div className="font-button text-[11px] uppercase tracking-[1.5px] text-muted tabular-nums">
              {answered} of {comps.length} scored
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="font-display text-[28px] font-semibold text-berry leading-none tabular-nums">
                {answered > 0 ? total : '—'}
              </span>
              <span className="text-muted text-sm">/100</span>
              {complete && <RecChip rec={recommendationFor(total)} />}
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {!stageLocked && !complete && (
              <span
                id="submit-incomplete-hint"
                className="text-[11px] text-muted max-w-[210px] text-right"
              >
                Score all {comps.length} competencies to submit
              </span>
            )}
            <button
              className={`${btnGhost} ${btnSm}`}
              onClick={() => setConfirmClear(true)}
              disabled={nothingToClear}
            >
              Clear
            </button>
            <button
              className={btnGreen}
              aria-disabled={!complete || undefined}
              aria-describedby={!stageLocked && !complete ? 'submit-incomplete-hint' : undefined}
              disabled={submitting || stageLocked}
              onClick={submit}
            >
              {submitting && <IconLoader size={14} className="animate-spin" />}
              {submitting ? 'Submitting…' : editing ? 'Update My Score' : 'Submit My Score'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear this scorecard?"
        confirmLabel="Clear all"
        onCancel={() => setConfirmClear(false)}
        onConfirm={doClear}
      >
        All selected levels, notes and red flags on this page will be reset.
        {editing
          ? ' Your previously submitted score is unaffected until you resubmit.'
          : ''}
      </ConfirmDialog>
    </>
  );
}
