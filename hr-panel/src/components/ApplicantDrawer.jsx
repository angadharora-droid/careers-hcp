import { useCallback, useEffect, useRef, useState } from 'react';
import DetailModal from './DetailModal';
import ConfirmDialog from './ConfirmDialog';
import OfferDialog from './OfferDialog';
import { ErrorBox, Skeleton, Loading } from './LoadState';
import CommentThread from './CommentThread';
import MoveRoleDialog from './MoveRoleDialog';
import { AssignmentChip, RecChip, StageBadge, BandPill } from './Badges';
import { api, downloadDocument, previewDocument, uploadDocuments } from '../lib/api';
import { inr, fmtDate, band, bandStanding } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  Check, AlertTriangle, Flag, FileText, Download, Eye, Trash, ChevronDown, ChevronUp,
  MessageSquare, Shuffle,
} from './Icons';

const RECRUITABLE = ['Vacant', 'Under Recruitment'];

// Must match REJECTION_REASONS in backend/src/models/Application.js — besides these,
// the server only accepts a free-text reason sent as "Other: <text>".
const REJECTION_REASONS = [
  'Frequent job changes / no stability',
  'Negative attitude or poor professionalism',
  'Weak communication skills',
  'Not suitable for hotel culture / team fit',
  'Lack of required skills or knowledge',
  'Over budget',
];
const OTHER_REASON = 'Other';
const OTHER_PREFIX = /^Other:\s*/;

const STAGE_BUTTONS = [
  { stage: 'Applied', label: 'Applied' },
  { stage: 'Interview Scheduled', label: 'Interview' },
  { stage: 'Selected', label: 'Select' },
  { stage: 'Rejected', label: 'Reject' },
  { stage: 'On Hold', label: 'Hold' },
];

// Panels run in order: Panel 1 interviews first, and Panel N stays locked for its
// interviewer until Panel N-1 is scored.
function roleFor(i) {
  return `Panel ${i + 1}`;
}

const pickerLabel = (u) =>
  `${u.name}${u.designation ? ` — ${u.designation}` : u.department ? ` — ${u.department}` : ''}`;

// Search-first interviewer picker. Suggested names (this job's fixed panel + the
// department's own interviewers) are offered up front; when the name HR wants is
// not among them, typing searches every registered interviewer and catches it.
function InterviewerPicker({ label, value, suggested, all, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = [...suggested, ...all].find((u) => String(u.id) === String(value)) || null;
  const term = q.trim().toLowerCase();
  const match = (u) => !term
    || [u.name, u.designation, u.department, ...(u.departments || [])]
      .some((s) => String(s || '').toLowerCase().includes(term));
  const suggestedIds = new Set(suggested.map((u) => String(u.id)));
  const top = suggested.filter(match);
  const rest = all.filter((u) => !suggestedIds.has(String(u.id))).filter(match);

  const pick = (id) => { onChange(id); setQ(''); setOpen(false); };

  const Group = ({ title, items }) => (
    <>
      <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-muted">{title}</div>
      {items.map((u) => (
        <button
          key={String(u.id)}
          type="button"
          className={`block w-full text-left px-2.5 py-1.5 text-xs hover:bg-berry-soft ${String(u.id) === String(value) ? 'font-bold' : ''}`}
          onClick={() => pick(String(u.id))}
        >
          {pickerLabel(u)}
        </button>
      ))}
    </>
  );

  return (
    <div className="relative flex-1 min-w-[200px]" ref={boxRef}>
      <input
        className="inp w-full"
        aria-label={label}
        placeholder="— search & appoint interviewer —"
        value={open ? q : (selected ? pickerLabel(selected) : '')}
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="absolute z-20 mt-0.5 w-full max-h-56 overflow-y-auto rounded-sm border border-line bg-card shadow-lg">
          {value && (
            <button type="button" className="block w-full text-left px-2.5 py-1.5 text-xs italic text-muted hover:bg-berry-soft" onClick={() => pick('')}>
              — clear this panel —
            </button>
          )}
          {top.length > 0 && <Group title="Suggested — fixed panel & department" items={top} />}
          {rest.length > 0 && <Group title={top.length ? 'Other interviewers' : 'All interviewers'} items={rest} />}
          {top.length === 0 && rest.length === 0 && (
            <div className="px-2.5 py-2 text-xs text-muted">No interviewer matches “{q}”.</div>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, children, full = false }) {
  return (
    <div className={`flex gap-2 text-xs py-1 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="font-bold min-w-[110px] shrink-0">{label}</span>
      <span className="min-w-0 break-words">{children ?? '—'}</span>
    </div>
  );
}

function SectionHeading({ children }) {
  return <h4 className="font-display text-[17px] font-semibold text-ink leading-tight">{children}</h4>;
}

const SUM_CHIP = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11.5px] font-semibold';

export default function ApplicantDrawer({ applicationId, onClose, onChanged }) {
  const toast = useToast();

  const [app, setApp] = useState(null);
  const [positions, setPositions] = useState([]);
  const [panelRule, setPanelRule] = useState(null);
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(true);

  const [panelSel, setPanelSel] = useState([]);
  const [panelErr, setPanelErr] = useState(null);
  const [panelBusy, setPanelBusy] = useState(false);

  const [showScores, setShowScores] = useState(false);
  const [scoresDetail, setScoresDetail] = useState(null);
  const [scoresErr, setScoresErr] = useState(null);
  const [expandedScores, setExpandedScores] = useState({});

  const [selStage, setSelStage] = useState('Applied');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionOther, setRejectionOther] = useState(''); // free text when reason is "Other"
  const [interviewDate, setInterviewDate] = useState('');
  const [stageErr, setStageErr] = useState(null);
  const [stageBusy, setStageBusy] = useState(false);

  // Offer terms live in their own dialog — opened on selection, reopenable after.
  const [offerOpen, setOfferOpen] = useState(false);

  // Styled confirm dialogs (no native browser confirms)
  const [partialConfirm, setPartialConfirm] = useState(null); // { count, needed } | null
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  // Only your own comments carry a delete control.
  const { user } = useAuth();
  const currentUserId = user?.id;
  const attachInputRef = useRef(null);

  const applyApp = useCallback((application) => {
    setApp(application);
    const size = application.rounds || application.panel_size || 2;
    // Keyed by round rather than array position — a gap in the middle must not
    // shift everyone else's round number.
    const byRound = new Map(
      (application.panel_assignments || []).map((a) => [a.round, a.interviewer?.id])
    );
    setPanelSel(Array.from({ length: size }, (_, i) =>
      byRound.get(i + 1) ? String(byRound.get(i + 1)) : ''
    ));
    setSelStage(application.stage);
    // "Other: <text>" splits back into the Other option + its free-text box.
    const storedReason = application.rejection_reason || '';
    if (OTHER_PREFIX.test(storedReason)) {
      setRejectionReason(OTHER_REASON);
      setRejectionOther(storedReason.replace(OTHER_PREFIX, ''));
    } else {
      setRejectionReason(storedReason);
      setRejectionOther('');
    }
    setInterviewDate(application.interview_date || '');
    setScoresDetail(null); // refetched lazily if the detail section is open
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      // The fixed panel and the department roster rank the picker's suggestions;
      // the full interviewer directory backs its search, so HR can appoint anyone.
      const [a, p, r, u] = await Promise.all([
        api.get(`/applications/${applicationId}`),
        api.get('/positions'), // gate check: any open seat under this job_code
        api.get(`/applications/${applicationId}/panel-rule`),
        api.get('/users?role=interviewer'),
      ]);
      applyApp(a.application);
      setPositions(p.positions || []);
      setPanelRule(r.rule || null);
      setInterviewers(u.users || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId, applyApp]);

  useEffect(() => { load(); }, [load]);

  // Lazy-load per-panellist detail whenever the section is open and stale.
  useEffect(() => {
    if (!showScores || scoresDetail || !app) return;
    let alive = true;
    setScoresErr(null);
    api.get(`/applications/${app.id}/scores`)
      .then((d) => { if (alive) setScoresDetail(d); })
      .catch((e) => { if (alive) setScoresErr(e.message); });
    return () => { alive = false; };
  }, [showScores, scoresDetail, app]);

  async function refreshGate() {
    try {
      const p = await api.get('/positions');
      setPositions(p.positions || []);
    } catch { /* gate refresh is best-effort */ }
  }

  async function savePanel() {
    setPanelErr(null);
    // Send the round explicitly — one interviewer may legitimately take several
    // rounds (the panel sheet puts the same person in rounds 1 and 3).
    const chosen = panelSel
      .map((id, i) => ({ interviewer_user_id: id, round: i + 1 }))
      .filter((x) => x.interviewer_user_id);
    if (!chosen.length) { setPanelErr('Appoint at least one interviewer'); return; }
    setPanelBusy(true);
    try {
      const d = await api.post(`/applications/${app.id}/assign-panel`, { assignments: chosen });
      applyApp(d.application);
      toast('Interview panel saved');
      onChanged();
    } catch (e) {
      setPanelErr(e.message); // duplicates / removing a scored panellist / unregistered account
    } finally {
      setPanelBusy(false);
    }
  }

  async function saveStage(allowPartial = false) {
    setStageErr(null);
    if (selStage === 'Rejected' && !rejectionReason.trim()) {
      setStageErr('Rejection reason is required');
      return;
    }
    if (selStage === 'Rejected' && rejectionReason === OTHER_REASON && !rejectionOther.trim()) {
      setStageErr('Please write the rejection reason');
      return;
    }
    const body = { stage: selStage };
    if (selStage === 'Rejected') {
      body.rejection_reason = rejectionReason === OTHER_REASON
        ? `Other: ${rejectionOther.trim()}`
        : rejectionReason.trim();
    }
    if (selStage === 'Interview Scheduled') body.interview_date = interviewDate.trim();
    if (allowPartial) body.allow_partial_panel = true;
    setStageBusy(true);
    try {
      const d = await api.patch(`/applications/${app.id}/stage`, body);
      applyApp(d.application);
      if (selStage === 'Selected' && d.filled_pcn) {
        toast(`Selected — seat ${d.filled_pcn} filled`);
        setOfferOpen(true); // offer terms are the next step — ask for them up front
      } else {
        toast('Stage updated');
      }
      onChanged();
      refreshGate(); // selection fills / releases seats
    } catch (e) {
      const summary = app.score_summary || {};
      if (!allowPartial && /allow_partial_panel/i.test(e.message) && (summary.count || 0) >= 1) {
        // Styled confirm-retry: override with fewer scores than the panel size.
        setPartialConfirm({ count: summary.count, needed: summary.needed });
      } else {
        setStageErr(e.message); // recruitment gate messages are user-facing
      }
    } finally {
      setStageBusy(false);
    }
  }

  async function deleteApplication() {
    setDeleteBusy(true);
    try {
      await api.del(`/applications/${app.id}`);
      toast('Application deleted');
      onChanged();
      onClose();
    } catch (e) {
      setDeleteConfirm(false);
      toast(e.message, 'error');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function openDoc(doc) {
    try {
      await downloadDocument(doc.filename, doc.original_name);
    } catch (e) {
      toast(`Could not open document: ${e.message}`, 'error');
    }
  }

  async function previewDoc(doc) {
    try {
      await previewDocument(doc.filename, doc.original_name);
    } catch (e) {
      toast(`Could not preview document: ${e.message}`, 'error');
    }
  }

  async function attachDocs(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file next time
    if (!files.length) return;
    setAttachBusy(true);
    try {
      const data = await uploadDocuments(app.id, files);
      applyApp(data.application);
      toast(`${files.length} document${files.length > 1 ? 's' : ''} attached`);
    } catch (err2) {
      toast(`Could not attach: ${err2.message}`, 'error');
    } finally {
      setAttachBusy(false);
    }
  }

  // Browsers render PDFs and images natively; DOC/DOCX would only re-download.
  const previewable = (doc) => /\.(pdf|jpe?g|png)$/i.test(doc.original_name || doc.filename || '');

  if (loading || err || !app) {
    return (
      <DetailModal onClose={onClose} labelledBy="applicant-title">
        <div className="p-5 md:p-6 overflow-y-auto">
          {err ? (
            <ErrorBox error={err} onRetry={load} />
          ) : (
            <div aria-hidden="true">
              <Skeleton className="h-7 w-2/3 mb-3" />
              <Skeleton className="h-4 w-1/2 mb-6" />
              <Skeleton className="h-24 mb-4" />
              <Skeleton className="h-40 mb-4" />
              <Skeleton className="h-28" />
            </div>
          )}
        </div>
      </DetailModal>
    );
  }

  const totalRounds = app.rounds || app.panel_size || 2;
  const committee = totalRounds === 3;
  const summary = app.score_summary || { count: 0, needed: totalRounds };
  const openSeats = positions.filter((p) => p.job_code === app.job_code && RECRUITABLE.includes(p.status));
  const gateOpen = openSeats.length > 0;
  const isSelected = app.stage === 'Selected' && app.pcn;

  /* Sanctioned salary band of the seat in play: the candidate's own seat once
     Selected, otherwise the widest band across the open seats under this job code.
     An offer is judged against this — under, within or over. */
  const bandSeats = isSelected ? positions.filter((p) => p.pcn === app.pcn) : openSeats;
  const lows = bandSeats.map((p) => p.salary_min).filter((n) => n > 0);
  const highs = bandSeats.map((p) => p.salary_max).filter((n) => n > 0);
  const seatMin = lows.length ? Math.min(...lows) : 0;
  const seatMax = highs.length ? Math.max(...highs) : 0;
  const bandLabel = band(seatMin, seatMax);
  // Only a real offer can sit against the band, so this is null until one is set.
  const offerStanding = bandStanding(app.offered_salary, seatMin, seatMax);

  return (
    <DetailModal onClose={onClose} labelledBy="applicant-title">
      {/* ===== Header ===== */}
      <div className="px-5 md:px-6 pt-5 pb-4 border-b border-line shrink-0">
        <h3 id="applicant-title" className="font-display text-[24px] font-semibold text-ink leading-tight pr-10">
          {app.candidate_name}
        </h3>
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          <StageBadge stage={app.stage} />
          <span className="pcn">{app.job_code}</span>
          <span className="mini">
            {app.designation} · Grade {app.grade} · {app.department}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setMoveOpen(true)}
            title="Push this application to a different role"
          >
            <Shuffle size={12} />
            Move role
          </button>
        </div>
        <p className="mini mt-1">
          Ref <span className="font-mono font-bold">{app.reference_id}</span> · applied {fmtDate(app.applied_on)} ·{' '}
          {committee ? <b className="text-brand-amber">3 interview panels</b> : '2 interview panels'}
        </p>

        {/* Recruitment gate banner */}
        {isSelected ? (
          <div className="gate gate-ok">
            <Check size={14} className="mt-px" />
            <span>Selected — occupies seat <b className="font-mono">{app.pcn}</b>.</span>
          </div>
        ) : gateOpen ? (
          <div className="gate gate-ok">
            <Check size={14} className="mt-px" />
            <span>
              {openSeats.length} open seat{openSeats.length > 1 ? 's' : ''} under <b className="font-mono">{app.job_code}</b> (Vacant / Under Recruitment) — recruitment permitted.
            </span>
          </div>
        ) : (
          <div className="gate">
            <AlertTriangle size={14} className="mt-px" />
            <span>
              No seat under <b className="font-mono">{app.job_code}</b> is Vacant or Under Recruitment — recruitment gate CLOSED. Cannot select into this role.
            </span>
          </div>
        )}
      </div>

      {/* ===== Scrollable body ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-6 py-4">
        {/* Offer summary — the terms themselves are edited in the Offer dialog */}
        {isSelected && (
          <section className="mb-5">
            <SectionHeading>Offer letter</SectionHeading>
            <div className="bg-berry-soft/60 border border-berry/25 rounded-sm p-3.5 mt-1.5 flex items-center gap-4 flex-wrap">
              <div className="text-xs">
                <div>
                  <b>Joining:</b>{' '}
                  {app.date_of_joining ? fmtDate(app.date_of_joining) : <span className="text-muted">not set</span>}
                  <span className="text-muted"> · </span>
                  <b>Offered:</b>{' '}
                  {app.offered_salary != null ? inr(app.offered_salary) : <span className="text-muted">not set</span>}
                </div>
                {app.offer_sent_at ? (
                  <p className="mini mt-1 inline-flex items-center gap-1">
                    <Check size={12} className="text-brand-green" />
                    Emailed to {app.offer_sent_to || app.email} on {fmtDate(app.offer_sent_at)}.
                  </p>
                ) : (
                  <p className="mini mt-1">Not yet sent to the candidate.</p>
                )}
              </div>
              <button type="button" className="btn btn-sm ml-auto" onClick={() => setOfferOpen(true)}>
                <FileText size={13} />
                Offer letter
              </button>
            </div>
          </section>
        )}

        {/* Candidate details — collapsible */}
        <section>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 py-1 cursor-pointer text-left group"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            <SectionHeading>Candidate details</SectionHeading>
            {detailsOpen
              ? <ChevronUp size={16} className="text-muted group-hover:text-berry transition-colors duration-150" />
              : <ChevronDown size={16} className="text-muted group-hover:text-berry transition-colors duration-150" />}
          </button>
          {detailsOpen && (
            <div className="bg-cream/40 border border-line rounded-sm p-3.5 mt-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
                <Info label="Age / Gender">{app.age || '—'} / {app.gender || '—'}</Info>
                <Info label="Mobile">{app.mobile || '—'}</Info>
                <Info label="Email">{app.email || '—'}</Info>
                <Info label="Qualification">{app.qualification || '—'}</Info>
                <Info label="Total Exp">{app.total_experience_years ?? '—'}y</Info>
                <Info label="Current Role">{app.current_designation || '—'} ({app.years_in_current_firm ?? '—'}y)</Info>
                <Info label="Salary">{inr(app.current_salary)} → {inr(app.expected_salary)} expected</Info>
                <Info label="Salary band">{bandLabel}</Info>
                <Info label="Offered">
                  {app.offered_salary == null ? '—' : (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {inr(app.offered_salary)}
                      <BandPill standing={offerStanding} />
                    </span>
                  )}
                </Info>
                <Info label="Relocate / Accom">{app.willing_to_relocate || '—'} / {app.needs_accommodation || '—'}</Info>
                <Info label="Worked at CPH before">{app.worked_at_cph_before || '—'}</Info>
                <Info label="Source">{app.source || '—'}</Info>
                <Info label="Why CPH">{app.why_join || '—'}</Info>
                <Info label="Intro" full>{app.intro_note || '—'}</Info>
              </div>
            </div>
          )}
        </section>

        {/* Role history — only once this application has actually been moved */}
        {app.move_history?.length > 0 && (
          <section className="mt-5">
            <SectionHeading>Role history</SectionHeading>
            <div className="mt-2">
              {app.move_history.map((m, i) => (
                <div key={`${m.moved_at}-${i}`} className="panel-box mt-0 mb-1.5">
                  <div className="text-[12.5px] text-body">
                    Moved from <b>{m.from_designation}</b> <span className="pcn">{m.from_job_code}</span>
                    {m.from_stage && <> (was {m.from_stage})</>}
                  </div>
                  <div className="mini mt-1">
                    {m.moved_by_name || 'HR'} · {fmtDate(m.moved_at)}
                    {m.note && <> · {m.note}</>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Shared notes — HR and this candidate's panellists both post and read */}
        <section className="mt-5">
          <SectionHeading>
            <span className="inline-flex items-center gap-1.5">
              Notes
              <MessageSquare size={13} className="text-muted" />
              {app.comment_count > 0 && (
                <span className="tabular-nums font-normal text-muted">{app.comment_count}</span>
              )}
            </span>
          </SectionHeading>
          <div className="mt-2">
            <CommentThread applicationId={app.id} currentUserId={currentUserId} compact />
          </div>
        </section>

        {/* Documents */}
        <section className="mt-5">
          <SectionHeading>Documents</SectionHeading>
          <div className="mt-2">
            {app.documents?.length ? (
              app.documents.map((d) => (
                <div key={d.filename} className="flex items-center gap-2.5 border border-line rounded-sm px-3 py-1.5 mb-1.5 bg-cream/30">
                  <FileText size={15} className="text-muted" />
                  <span className="text-xs text-body flex-1 min-w-0 truncate">{d.original_name || d.filename}</span>
                  {previewable(d) && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Preview ${d.original_name || d.filename}`}
                      title="Preview"
                      onClick={() => previewDoc(d)}
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Download ${d.original_name || d.filename}`}
                    title="Download"
                    onClick={() => openDoc(d)}
                  >
                    <Download size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="mini">No documents uploaded with this application.</p>
            )}
            <input
              ref={attachInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              onChange={attachDocs}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-1"
              onClick={() => attachInputRef.current?.click()}
              disabled={attachBusy}
            >
              {attachBusy ? 'Attaching…' : 'Attach PDF'}
            </button>
            <p className="mini mt-1">
              For documents the candidate sent directly — e.g. a re-sent CV. PDF only, up to 5 MB each.
            </p>
          </div>
        </section>

        {/* Interview panel */}
        <section className="mt-5">
          <SectionHeading>Interview panel</SectionHeading>
          <p className="mini mt-0.5">
            Grade {app.grade} runs {app.rounds || app.panel_size} interview panel{(app.rounds || app.panel_size) > 1 ? 's' : ''}, in order.
            Suggestions come from the job's fixed panel and the {app.department} team — type to search every registered interviewer.
          </p>
          <div className="panel-box">
            {!panelRule && (
              <div className="mini mb-1.5">
                No fixed panel is defined for {app.unit_code} / grade {app.grade} / {app.department} —
                search and appoint the panellists by name.
              </div>
            )}
            {(() => {
              // Directory entries, normalised for the picker.
              const directory = interviewers.map((u) => ({
                id: String(u.id), name: u.name, designation: u.designation,
                department: u.department, departments: u.departments || [],
              }));
              // Suggested = everyone the matrix names anywhere on this job, plus every
              // interviewer whose department (home or extra) is the job's department.
              const deptKey = String(app.department || '').trim().toLowerCase();
              const suggested = [];
              const suggest = (u) => {
                if (u && !suggested.some((o) => String(o.id) === String(u.id))) suggested.push(u);
              };
              for (const slot of panelRule?.rounds || []) {
                for (const u of [slot.interviewer, ...(slot.alternates || [])]) {
                  if (u) suggest({ id: String(u._id), name: u.name, designation: u.designation, department: u.department });
                }
              }
              for (const u of directory) {
                if ([u.department, ...u.departments].some((d) => String(d || '').trim().toLowerCase() === deptKey)) suggest(u);
              }
              return panelSel.map((sel, i) => {
                const assignment = (app.panel_assignments || []).find((a) => a.round === i + 1);
                // A panel already scored keeps its panellist even if the account has
                // since left the directory — it must stay resolvable to re-save the form.
                const all = [...directory];
                if (assignment?.status === 'Scored' && assignment.interviewer
                    && !all.some((u) => String(u.id) === String(assignment.interviewer.id))) {
                  all.push({ id: String(assignment.interviewer.id), name: assignment.interviewer.name, designation: assignment.interviewer.designation });
                }
                return (
                  <div key={i} className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="mini min-w-[150px]">{roleFor(i)}</span>
                    <InterviewerPicker
                      label={roleFor(i)}
                      value={sel}
                      suggested={suggested}
                      all={all}
                      onChange={(id) => setPanelSel((arr) => arr.map((v, j) => (j === i ? id : v)))}
                    />
                    {assignment && <AssignmentChip status={assignment.status} />}
                  </div>
                );
              });
            })()}
            <ErrorBox error={panelErr} />
            <button type="button" className="btn btn-sm mt-1" onClick={savePanel} disabled={panelBusy}>
              {panelBusy ? 'Saving…' : 'Save panel'}
            </button>
          </div>
        </section>

        {/* Panel scores */}
        <section className="mt-5">
          <SectionHeading>Panel scores</SectionHeading>
          {summary.count === 0 ? (
            <p className="mini mt-1.5">No scores yet — waiting on {summary.needed} panellist{summary.needed > 1 ? 's' : ''}.</p>
          ) : (
            <div className="mt-2">
              {/* Summary chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`${SUM_CHIP} bg-berry-soft text-berry tabular-nums`}>
                  Avg {summary.average}/100
                </span>
                <span className={`${SUM_CHIP} bg-beige/70 text-body tabular-nums`}>
                  {summary.count}/{summary.needed} scored
                </span>
                <RecChip rec={summary.recommendation} />
                {summary.diverged && (
                  <span className={`${SUM_CHIP} bg-brand-red/10 text-brand-red`}>
                    <AlertTriangle size={12} />
                    Diverged {summary.spread}pts — discuss, don't average
                  </span>
                )}
                {summary.any_red_flags && (
                  <span className={`${SUM_CHIP} bg-brand-red/10 text-brand-red`}>
                    <Flag size={12} />
                    Red flag — HR review required
                  </span>
                )}
              </div>
              {summary.count < summary.needed && (
                <p className="mini mt-1.5">Waiting on {summary.needed - summary.count} more panellist{summary.needed - summary.count > 1 ? 's' : ''}.</p>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2.5"
                aria-expanded={showScores}
                onClick={() => setShowScores((v) => !v)}
              >
                {showScores ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showScores ? 'Hide per-panellist breakdown' : 'Per-panellist breakdown'}
              </button>

              {showScores && (
                <div className="mt-2">
                  <ErrorBox error={scoresErr} />
                  {!scoresDetail && !scoresErr && <Loading label="Loading scores…" />}
                  {scoresDetail?.scores?.map((sc) => (
                    <div key={sc.id} className="border border-line rounded-sm p-3 mt-2">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <b>{sc.panelist_name}</b>
                        <span className="mini">({sc.panel_role})</span>
                        <span className="tabular-nums"><b className="text-berry text-sm">{sc.total_score}</b>/100</span>
                        {sc.red_flags?.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-brand-red font-semibold">
                            <Flag size={12} />
                            {sc.red_flags.join(', ')}
                          </span>
                        )}
                        <span className="mini">{fmtDate(sc.submitted_at)}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm ml-auto"
                          aria-expanded={!!expandedScores[sc.id]}
                          onClick={() => setExpandedScores((m) => ({ ...m, [sc.id]: !m[sc.id] }))}
                        >
                          {expandedScores[sc.id] ? 'Hide breakdown' : 'Breakdown'}
                        </button>
                      </div>
                      {expandedScores[sc.id] && (
                        <div className="mt-1.5">
                          <div className="overflow-x-auto">
                            <table className="tbl bg-card">
                              <thead>
                                <tr><th>Competency</th><th>Level</th><th className="num">Points</th></tr>
                              </thead>
                              <tbody>
                                {(sc.competency_breakdown || []).map((cb) => (
                                  <tr key={cb.competency_key}>
                                    <td>{cb.name}</td>
                                    <td>{cb.level_label}</td>
                                    <td className="num font-bold">{cb.points}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {sc.evidence_notes && <div className="mini mt-1"><b>Evidence:</b> {sc.evidence_notes}</div>}
                          {sc.strengths && <div className="mini"><b>Strengths:</b> {sc.strengths}</div>}
                          {sc.concerns && <div className="mini"><b>Concerns:</b> {sc.concerns}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ===== Sticky footer — stage control ===== */}
      <div className="border-t border-line bg-card px-5 md:px-6 py-3.5 shrink-0">
        <div
          className="flex border border-line rounded-sm overflow-hidden w-fit flex-wrap bg-card"
          role="group"
          aria-label="Application stage"
        >
          {STAGE_BUTTONS.map((b) => (
            <button
              key={b.stage}
              type="button"
              aria-pressed={selStage === b.stage}
              className={`font-button px-3.5 py-2 min-h-10 text-[11px] font-medium uppercase tracking-[1.5px] cursor-pointer transition-colors duration-150 ${
                selStage === b.stage ? 'bg-berry text-white' : 'bg-card text-muted hover:text-berry'
              }`}
              onClick={() => setSelStage(b.stage)}
            >
              {b.label}
            </button>
          ))}
        </div>

        {selStage === 'Rejected' && (
          <div>
            <label className="lbl" htmlFor="rejection-reason">Rejection Reason <span className="text-brand-red">*</span></label>
            <select
              id="rejection-reason"
              className="inp"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            >
              <option value="">— select reason —</option>
              {rejectionReason && rejectionReason !== OTHER_REASON && !REJECTION_REASONS.includes(rejectionReason) && (
                <option value={rejectionReason}>{rejectionReason} (legacy)</option>
              )}
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value={OTHER_REASON}>Other…</option>
            </select>
            {rejectionReason === OTHER_REASON && (
              <textarea
                className="inp mt-1.5"
                rows={2}
                maxLength={290}
                value={rejectionOther}
                onChange={(e) => setRejectionOther(e.target.value)}
                placeholder="Write the rejection reason…"
                aria-label="Other rejection reason"
              />
            )}
          </div>
        )}
        {selStage === 'Interview Scheduled' && (
          <div>
            <label className="lbl" htmlFor="interview-date">Interview Date/Time</label>
            <input
              id="interview-date"
              className="inp"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              placeholder="e.g. 02 Jul 2026, 11:00 AM"
            />
          </div>
        )}
        {selStage === 'Selected' && !isSelected && (
          <p className="hint mt-1.5">
            Fills a vacant seat under <b className="font-mono">{app.job_code}</b> and records {app.candidate_name} as occupant. Requires panel scores and an open seat — the offer details open next.
          </p>
        )}
        {selStage === 'Selected' && isSelected && (
          <p className="hint mt-1.5">
            {app.candidate_name} occupies <b className="font-mono">{app.pcn}</b>. Use <b>Offer letter</b> above to set the joining date and salary.
          </p>
        )}

        <ErrorBox error={stageErr} />
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <button
            type="button"
            className="btn btn-red btn-sm"
            onClick={() => setDeleteConfirm(true)}
            disabled={deleteBusy}
          >
            <Trash size={13} />
            Delete
          </button>
          <button
            type="button"
            className="btn ml-auto"
            onClick={() => saveStage(false)}
            disabled={stageBusy}
          >
            {stageBusy ? 'Saving…' : 'Save stage'}
          </button>
        </div>
      </div>

      {/* ===== Offer terms — centered dialog, opened on selection ===== */}
      {offerOpen && isSelected && (
        <OfferDialog
          app={app}
          onClose={() => setOfferOpen(false)}
          onUpdated={(updated) => { applyApp(updated); onChanged(); }}
        />
      )}

      {/* ===== Styled confirms ===== */}
      {partialConfirm && (
        <ConfirmDialog
          title="Select with a partial panel?"
          body={
            <>
              Only <b>{partialConfirm.count}/{partialConfirm.needed}</b> panellist{partialConfirm.needed > 1 ? 's have' : ' has'} scored{' '}
              {app.candidate_name}. Overriding records the selection with fewer scores than the panel requires.
            </>
          }
          confirmLabel="Override & select"
          tone="primary"
          onCancel={() => setPartialConfirm(null)}
          onConfirm={() => { setPartialConfirm(null); saveStage(true); }}
        />
      )}
      {moveOpen && (
        <MoveRoleDialog
          app={app}
          positions={positions}
          onClose={() => setMoveOpen(false)}
          onMoved={async () => { await load(); onChanged(); }}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete application?"
          body={
            <>
              This permanently removes <b>{app.candidate_name}</b>'s application ({app.reference_id}) and its documents. This cannot be undone.
            </>
          }
          confirmLabel="Delete application"
          tone="danger"
          busy={deleteBusy}
          onCancel={() => setDeleteConfirm(false)}
          onConfirm={deleteApplication}
        />
      )}
    </DetailModal>
  );
}
