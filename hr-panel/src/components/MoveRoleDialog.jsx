import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { band } from '../lib/format';
import { ErrorBox, Spinner } from './LoadState';
import { Search, AlertTriangle, Shuffle } from './Icons';
import { useToast } from '../context/ToastContext';

/* Push an application to a different role — the candidate applied to the wrong
   post, or reads better somewhere else. The reference ID survives the move, so
   the Application Register still shows one unique ID per application and the old
   role is kept in the move history.

   The server refuses the move once any round has been scored: those scores were
   made on the old scorecard, and a different grade or department runs a different
   one. This dialog says so up front rather than letting HR discover it on submit. */

export default function MoveRoleDialog({ app, positions, onClose, onMoved }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null); // { job_code, designation, ... }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const scored = app.score_summary?.count || 0;
  const blocked = scored > 0 || app.stage === 'Selected';

  /* Only roles with a seat open to recruit into — moving an application onto a
     fully filled role would leave it stranded with nothing to be selected into.
     Grouped by job_code + designation, the same key the register is kept by. */
  const roles = useMemo(() => {
    const open = positions.filter((p) => ['Vacant', 'Under Recruitment'].includes(p.status));
    const byKey = new Map();
    for (const p of open) {
      const key = `${p.job_code}||${p.designation}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          job_code: p.job_code,
          designation: p.designation,
          department: p.department,
          grade: p.grade,
          salary_min: p.salary_min,
          salary_max: p.salary_max,
          seats: 0,
        });
      }
      byKey.get(key).seats += 1;
    }
    return [...byKey.values()]
      // The role it is already on is not a destination.
      .filter((r) => !(r.job_code === app.job_code && r.designation === app.designation))
      .sort((a, b) => a.department.localeCompare(b.department) || a.designation.localeCompare(b.designation));
  }, [positions, app.job_code, app.designation]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return roles;
    return roles.filter((r) => `${r.designation} ${r.job_code} ${r.department} ${r.grade}`.toLowerCase().includes(needle));
  }, [roles, q]);

  async function move() {
    if (!picked) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/applications/${app.id}/move`, {
        job_code: picked.job_code,
        designation: picked.designation,
        note: note.trim(),
      });
      toast(`${app.candidate_name} moved to ${picked.designation}`);
      await onMoved();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const gradeChanges = picked && picked.grade !== app.grade;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[70] p-4 flex anim-fade overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Move application to another role"
        className="bg-card border border-line rounded-md w-full max-w-xl p-6 m-auto anim-pop"
      >
        <h3 className="font-display text-[22px] font-semibold text-ink leading-tight">Move to another role</h3>
        <p className="text-[13px] text-body mt-2">
          <b>{app.candidate_name}</b> is currently against <b>{app.designation}</b>{' '}
          <span className="pcn">{app.job_code}</span>. The application ID{' '}
          <span className="font-mono font-bold text-berry">{app.reference_id}</span> stays the same, and the
          old role is kept in this application&rsquo;s history.
        </p>

        {blocked ? (
          <div className="gate mt-4">
            <AlertTriangle size={14} className="mt-px shrink-0" />
            <span>
              {app.stage === 'Selected' ? (
                <>
                  This candidate is <b>Selected</b> and holds seat <b className="font-mono">{app.pcn}</b>.
                  Move them out of Selected first — that releases the seat — then the application can be moved.
                </>
              ) : (
                <>
                  <b>{scored} interview round{scored === 1 ? '' : 's'}</b> have already been scored against{' '}
                  {app.designation}, on the scorecard for that role. A different role runs a different
                  scorecard, so the move is refused.{' '}
                  {['Rejected', 'Not Shortlisted'].includes(app.stage)
                    ? 'Ask the candidate to apply afresh to the other role — this application keeps the history.'
                    : 'Reject this application and ask the candidate to apply to the other role instead.'}
                </>
              )}
            </span>
          </div>
        ) : (
          <>
            <div className="relative mt-4">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                ref={searchRef}
                className="inp pl-8"
                placeholder="Search role / job code / department…"
                aria-label="Search roles"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="border border-line rounded-sm mt-2 max-h-[240px] overflow-y-auto">
              {shown.length === 0 ? (
                <p className="mini p-3">
                  {roles.length === 0
                    ? 'No other role currently has a Vacant or Under Recruitment seat to move into.'
                    : 'No role matches that search.'}
                </p>
              ) : (
                shown.map((r) => {
                  const on = picked?.key === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked(r)}
                      className={`w-full text-left px-3 py-2 border-b border-line last:border-b-0 cursor-pointer transition-colors duration-150 ${
                        on ? 'bg-berry-soft' : 'hover:bg-cream/60'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <b className="text-[13px] text-ink">{r.designation}</b>
                        <span className="pcn">{r.job_code}</span>
                      </div>
                      <div className="mini">
                        {r.department} · Grade {r.grade} · {r.seats} open seat{r.seats === 1 ? '' : 's'} ·{' '}
                        {band(r.salary_min, r.salary_max)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {picked && (
              <>
                <div className="scoresum mt-3">
                  Moving to <b>{picked.designation}</b> resets the application to <b>Applied</b> and clears any
                  panel appointed for {app.designation}
                  {gradeChanges && (
                    <> — grade <b>{app.grade}</b> → <b>{picked.grade}</b>, so the interview runs a different
                      scorecard and a possibly different number of rounds</>
                  )}
                  . No score exists to lose.
                </div>
                <label className="lbl" htmlFor="move-note">Why (optional)</label>
                <input
                  id="move-note"
                  className="inp"
                  maxLength={300}
                  placeholder="e.g. Stronger fit for F&amp;B than Front Office"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </>
            )}
          </>
        )}

        <ErrorBox error={err} />

        <div className="flex gap-2 justify-end mt-6 flex-wrap">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {blocked ? 'Close' : 'Cancel'}
          </button>
          {!blocked && (
            <button type="button" className="btn" onClick={move} disabled={!picked || busy}>
              {busy ? <Spinner className="w-3.5 h-3.5" /> : <Shuffle size={13} />}
              {busy ? 'Moving…' : 'Move application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
