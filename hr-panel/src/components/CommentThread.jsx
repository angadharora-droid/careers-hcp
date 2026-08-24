import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBox, Spinner } from './LoadState';
import { MessageSquare, Send, Trash } from './Icons';
import { useToast } from '../context/ToastContext';

/* The shared note thread on one application. HR and the candidate's own panellists
   both post and both read, so an operational detail ("candidate asked to move R2",
   "salary approval still with the GM") is on the record for everyone working the
   candidate rather than living in someone's inbox.

   Comments are deliberately not scores — nothing here feeds the recommendation. */

// 'just now' / '14m' / '3h' / '5d', then the plain date once it stops being useful.
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

export default function CommentThread({ applicationId, currentUserId, compact = false }) {
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api.get(`/applications/${applicationId}/comments`);
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
      const d = await api.post(`/applications/${applicationId}/comments`, { body });
      setComments((c) => [...c, d.comment]);
      setDraft('');
      boxRef.current?.focus();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPosting(false);
    }
  }

  async function remove(id) {
    setRemoving(id);
    try {
      await api.del(`/applications/${applicationId}/comments/${id}`);
      setComments((c) => c.filter((x) => x.id !== id));
      toast('Comment deleted');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div>
      <ErrorBox error={err} onRetry={load} />

      {loading ? (
        <div className="mini py-3"><Spinner className="align-[-3px] mr-2 w-3.5 h-3.5" />Loading notes…</div>
      ) : comments.length === 0 ? (
        <p className="mini py-2">
          No notes yet. Anything the scorecard has no room for — a reschedule, a pending approval,
          a reference check — belongs here, where HR and the panel both see it.
        </p>
      ) : (
        <ul className={`flex flex-col gap-2 mb-3 ${compact ? 'max-h-[280px] overflow-y-auto pr-1' : ''}`}>
          {comments.map((c) => {
            const isHR = c.author.role === 'hr_admin';
            const mine = currentUserId && String(c.author.id) === String(currentUserId);
            return (
              <li key={c.id} className="flex gap-2.5 group">
                <span
                  className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold tabular-nums ${
                    isHR ? 'bg-berry-soft text-berry' : 'bg-brand-blue/10 text-brand-blue'
                  }`}
                  aria-hidden="true"
                >
                  {initialsOf(c.author.name)}
                </span>
                <div className="flex-1 min-w-0 bg-cream/50 border border-line rounded-sm px-3 py-2">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <b className="text-[12.5px] text-ink">{c.author.name}</b>
                    <span className="mini">
                      {isHR ? 'People & Culture' : c.author.designation || 'Interview panel'}
                      {' · '}
                      <time dateTime={c.created_at} title={new Date(c.created_at).toLocaleString('en-IN')}>
                        {ago(c.created_at)}
                      </time>
                    </span>
                    {mine && (
                      <button
                        type="button"
                        className="ml-auto icon-btn w-6 h-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150"
                        aria-label="Delete this comment"
                        title="Delete this comment"
                        disabled={removing === c.id}
                        onClick={() => remove(c.id)}
                      >
                        {removing === c.id ? <Spinner className="w-3 h-3" /> : <Trash size={12} />}
                      </button>
                    )}
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
          className="inp resize-y min-h-[38px] py-2"
          rows={2}
          maxLength={2000}
          placeholder="Add a note for everyone working this candidate…"
          aria-label="Write a comment"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Enter sends; Shift+Enter is the newline, as every chat box behaves.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); }
          }}
        />
        <button
          type="button"
          className="btn btn-sm shrink-0"
          onClick={post}
          disabled={!draft.trim() || posting}
        >
          {posting ? <Spinner className="w-3.5 h-3.5" /> : <Send size={13} />}
          Post
        </button>
      </div>
      <p className="hint">Enter to post · Shift+Enter for a new line. Visible to HR and this candidate&rsquo;s panel.</p>
    </div>
  );
}

// The section wrapper used in the drawer, with the count in the heading.
export function CommentCount({ n }) {
  return (
    <span className="inline-flex items-center gap-1 mini">
      <MessageSquare size={12} />
      {n || 0}
    </span>
  );
}
