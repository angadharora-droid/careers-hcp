import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBox, Spinner } from './LoadState';
import {
  Inbox, Users, Check, CheckCircle, FileText, Shuffle, Mail, ClipboardCheck, Clock, Pencil, AlertCircle,
} from './Icons';

/* The application's history, oldest first. Compiled server-side from three
   sources (the application itself, the panel scores, and the HR action log), so
   an application that predates the action log still shows a real timeline rather
   than an empty one.

   Read-only by design: this is the audit trail the Application Register leans on,
   not somewhere to edit the past. */

const MARKERS = {
  applied: { icon: Inbox, tone: 'blue', label: 'Applied' },
  stage: { icon: Check, tone: 'berry', label: 'Stage' },
  panel: { icon: Users, tone: 'blue', label: 'Panel' },
  score: { icon: ClipboardCheck, tone: 'green', label: 'Score' },
  offer: { icon: Mail, tone: 'amber', label: 'Offer' },
  approval: { icon: CheckCircle, tone: 'green', label: 'Approval' },
  move: { icon: Shuffle, tone: 'amber', label: 'Move' },
  document: { icon: FileText, tone: 'muted', label: 'Document' },
  edit: { icon: Pencil, tone: 'muted', label: 'Edit' },
};

// Stage rows say what they became, so the marker colour follows the outcome
// rather than the event type — a rejection should not read the same as a hire.
function toneFor(item) {
  if (item.type === 'stage') {
    if (item.to === 'Selected') return 'green';
    if (item.to === 'Rejected') return 'red';
    if (item.to === 'On Hold') return 'muted';
    return 'berry';
  }
  return MARKERS[item.type]?.tone || 'muted';
}

const TONES = {
  berry: 'bg-berry-soft text-berry border-berry/30',
  green: 'bg-brand-green/10 text-brand-green border-brand-green/30',
  red: 'bg-brand-red/10 text-brand-red border-brand-red/30',
  amber: 'bg-brand-amber/12 text-brand-amber border-brand-amber/30',
  blue: 'bg-brand-blue/10 text-brand-blue border-brand-blue/30',
  muted: 'bg-beige text-muted border-line',
};

function stamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// "3 days later" between consecutive entries — the gaps are the interesting part.
function gapLabel(prevIso, iso) {
  if (!prevIso) return null;
  const ms = new Date(iso) - new Date(prevIso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} later`;
  const hrs = Math.floor(ms / 3600000);
  if (hrs >= 1) return `${hrs}h later`;
  return null;
}

export default function Timeline({ applicationId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await api.get(`/applications/${applicationId}/timeline`));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="mini py-3"><Spinner className="align-[-3px] mr-2 w-3.5 h-3.5" />Loading timeline…</div>;
  }
  if (err) return <ErrorBox error={err} onRetry={load} />;

  const items = data?.timeline || [];
  const awaiting = data?.current?.awaiting;

  if (!items.length) return <p className="mini py-2">Nothing recorded yet.</p>;

  return (
    <>
    {/* Stage moves were not logged before this application was worked, so its
        history shows the milestones that were timestamped, not every step. */}
    {data?.reconstructed && (
      <p className="mini flex items-start gap-1.5 mb-2.5 pb-2 border-b border-line">
        <AlertCircle size={12} className="mt-px shrink-0" />
        Part of this history is reconstructed from the panel, offer and document records.
        Stage changes made before activity logging began were never stored and cannot be shown.
      </p>
    )}
    <ol className="relative pl-7">
      {/* the spine */}
      <span aria-hidden="true" className="absolute left-[11px] top-1.5 bottom-3 w-px bg-line" />

      {items.map((it, i) => {
        const IconCmp = MARKERS[it.type]?.icon || Check;
        const tone = TONES[toneFor(it)] || TONES.muted;
        const gap = gapLabel(items[i - 1]?.at, it.at);
        return (
          <li key={`${it.at}-${i}`} className="relative pb-4 last:pb-0">
            <span
              className={`absolute -left-7 top-0 w-[23px] h-[23px] rounded-full border grid place-items-center ${tone}`}
              aria-hidden="true"
            >
              <IconCmp size={12} />
            </span>
            {gap && <div className="mini italic mb-0.5">{gap}</div>}
            <div className="text-[13px] text-ink font-medium leading-snug">
              {it.summary}
              {it.type === 'stage' && it.from && it.from !== it.to && (
                <span className="mini font-normal"> · from {it.from}</span>
              )}
            </div>
            {it.detail && <div className="text-[12px] text-body mt-0.5 break-words">{it.detail}</div>}
            <div className="mini mt-0.5">
              <time dateTime={it.at}>{stamp(it.at)}</time>
              {it.actor_name && (
                <> · {it.actor_name}
                  {it.actor_role === 'hr_admin' && ' (People & Culture)'}
                  {it.actor_role === 'interviewer' && ' (panel)'}
                </>
              )}
            </div>
          </li>
        );
      })}

      {/* The open end: what the application is waiting on right now. */}
      {awaiting && (
        <li className="relative pt-1">
          <span
            className="absolute -left-7 top-0.5 w-[23px] h-[23px] rounded-full border border-dashed border-brand-amber/60 bg-brand-amber/5 text-brand-amber grid place-items-center"
            aria-hidden="true"
          >
            <Clock size={12} />
          </span>
          <div className="text-[13px] text-brand-amber font-medium">Awaiting {awaiting}</div>
        </li>
      )}
    </ol>
    </>
  );
}
