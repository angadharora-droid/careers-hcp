import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getStoredUser } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { btnPrimary, btnSm, ErrorBox, textareaCls } from './ui';
import { IconLoader } from './Icons';

/* The shared note thread on one candidate. HR and the panellists appointed to
   this candidate both post and both read — an operational detail ("candidate
   rang to move the round", "asked to bring the original certificates") lands
   where everyone working the candidate sees it.

   Notes are NOT part of the assessment: nothing written here feeds the score or
   the recommendation. The backend only serves this thread to HR and to the
   interviewers actually on the candidate's panel. */

function ago(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const initialsOf = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export default function CommentThread({ applicationId }) {
  const toast = useToast();
  const me = getStoredUser();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api(`/applications/${applicationId}/comments`);
      setComments(d.comments || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { load(); }, [load]);

  async function post() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const d = await api(`/applications/${applicationId}/comments`, {
        method: 'POST',
        body: { body },
      });
      setComments((c) => [...c, d.comment]);
      setDraft('');
      boxRef.current?.focus();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      {err && <ErrorBox onRetry={load}>{err}</ErrorBox>}

      {loading ? (
        <p className="text-[11px] text-muted py-2">Loading notes…</p>
      ) : comments.length === 0 ? (
        <p className="text-[12.5px] text-muted py-1">
          No notes yet. Anything the scorecard has no room for — a reschedule, a document to chase —
          belongs here, where People &amp; Culture and the rest of the panel both see it.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 mb-3 max-h-[320px] overflow-y-auto pr-1">
          {comments.map((c) => {
            const isHR = c.author.role === 'hr_admin';
            const mine = me?.id && String(c.author.id) === String(me.id);
            return (
              <li key={c.id} className="flex gap-2.5">
                <span
                  className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold ${
                    isHR ? 'bg-[#f3e8ef] text-berry' : 'bg-[#e7eff7] text-brand-blue'
                  }`}
                  aria-hidden="true"
                >
                  {initialsOf(c.author.name)}
                </span>
                <div className="flex-1 min-w-0 bg-beige/40 border border-line rounded-sm px-3 py-2">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <b className="text-[12.5px] text-ink">
                      {c.author.name}{mine && <span className="font-normal text-muted"> (you)</span>}
                    </b>
                    <span className="text-[11px] text-muted">
                      {isHR ? 'People & Culture' : c.author.designation || 'Interview panel'}
                      {' · '}
                      <time dateTime={c.created_at} title={new Date(c.created_at).toLocaleString('en-IN')}>
                        {ago(c.created_at)}
                      </time>
                    </span>
                  </div>
                  <p className="text-[12.5px] text-body mt-1 whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2 items-end">
        <textarea
          ref={boxRef}
          className={`${textareaCls} min-h-[44px]`}
          rows={2}
          maxLength={2000}
          placeholder="Add a note for People & Culture and the rest of the panel…"
          aria-label="Write a note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); }
          }}
        />
        <button
          type="button"
          className={`${btnPrimary} ${btnSm} shrink-0`}
          onClick={post}
          disabled={!draft.trim() || posting}
        >
          {posting && <IconLoader className="animate-spin" size={13} />}
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>
      <p className="text-[11px] text-muted mt-1">
        Enter to post · Shift+Enter for a new line. Notes are not part of your score.
      </p>
    </div>
  );
}
