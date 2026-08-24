import { useEffect, useRef, useState } from 'react';
import { ErrorBox } from './LoadState';
import { api, openOfferLetter } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { Check, FileText, Mail, X, Trash } from './Icons';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Offer terms + letter actions, as a centered dialog opened right after a selection
// (and reopenable from the applicant panel). It nests inside the applicant dialog, so
// Escape/Tab stop here rather than closing the parent — same approach as ConfirmDialog.
export default function OfferDialog({ app, onClose, onUpdated }) {
  const toast = useToast();
  const panelRef = useRef(null);
  const firstRef = useRef(null);
  const prevFocus = useRef(null);

  const [dateOfJoining, setDateOfJoining] = useState(app.date_of_joining || '');
  const [offeredSalary, setOfferedSalary] = useState(
    app.offered_salary != null ? String(app.offered_salary) : ''
  );
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  /* Recording a send the unit made itself — from their own mailbox, over
     WhatsApp, or by hand. Server SMTP is optional in most deployments, so
     without this the register would show "not sent" for offers that did go out. */
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [sentOn, setSentOn] = useState(today);
  const [sentTo, setSentTo] = useState(app.email || '');
  const [sentNote, setSentNote] = useState('');

  useEffect(() => {
    prevFocus.current = document.activeElement;
    firstRef.current?.focus();
    return () => prevFocus.current?.focus?.();
  }, []);

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    e.stopPropagation();
    const els = panelRef.current?.querySelectorAll(FOCUSABLE);
    if (!els || !els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Persist what's on screen first, so a generated/emailed letter always matches the fields.
  async function persist() {
    const d = await api.patch(`/applications/${app.id}/offer`, {
      date_of_joining: dateOfJoining,
      offered_salary: offeredSalary === '' ? null : Number(offeredSalary),
    });
    onUpdated(d.application);
    return d.application;
  }

  function incomplete(a) {
    if (!a.date_of_joining || a.offered_salary == null) {
      setErr('Set a date of joining and offered salary first.');
      return true;
    }
    return false;
  }

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      await persist();
      toast('Offer details saved');
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    setErr(null);
    setBusy(true);
    try {
      const updated = await persist();
      if (incomplete(updated)) return;
      await openOfferLetter(app.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function openMailClient(a) {
    const subject = `Offer of Employment — ${a.designation}, Centre Point Amravati`;
    const bodyText = [
      `Dear ${a.candidate_name},`, '',
      `We are pleased to offer you the position of ${a.designation} (Grade ${a.grade}) at Centre Point Amravati.`,
      a.date_of_joining ? `Proposed date of joining: ${a.date_of_joining}.` : '',
      a.offered_salary != null ? `Offered monthly salary: INR ${a.offered_salary}.` : '',
      '', 'Your formal offer letter is attached.', '',
      'Warm regards,', 'Human Resources, Centre Point Amravati',
    ].filter(Boolean).join('\n');
    window.location.href =
      `mailto:${encodeURIComponent(a.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  }

  async function email() {
    setErr(null);
    setEmailBusy(true);
    try {
      const updated = await persist();
      if (incomplete(updated)) return;
      try {
        const d = await api.post(`/applications/${app.id}/send-offer`, {});
        onUpdated(d.application);
        toast(`Offer emailed to ${d.sent_to}`);
      } catch (e) {
        // No server SMTP → hand off to the HR user's own mail client instead.
        if (/not configured|SMTP|nodemailer/i.test(e.message)) {
          openMailClient(updated);
          // The mail app takes over from here, so nothing has been recorded yet —
          // open the manual form so the send can be logged once it goes out.
          setManualOpen(true);
          toast('Opening your mail app — then record the send below');
        } else {
          setErr(e.message);
        }
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setEmailBusy(false);
    }
  }

  async function recordManual() {
    setErr(null);
    setManualBusy(true);
    try {
      const updated = await persist();
      if (incomplete(updated)) return;
      const d = await api.post(`/applications/${app.id}/offer-sent`, {
        sent_on: sentOn,
        sent_to: sentTo,
        note: sentNote,
      });
      onUpdated(d.application);
      setManualOpen(false);
      toast('Recorded — offer letter sent manually');
    } catch (e) {
      setErr(e.message);
    } finally {
      setManualBusy(false);
    }
  }

  async function clearManual() {
    setErr(null);
    setManualBusy(true);
    try {
      const d = await api.del(`/applications/${app.id}/offer-sent`);
      onUpdated(d.application);
      toast('Offer-sent record removed');
    } catch (e) {
      setErr(e.message);
    } finally {
      setManualBusy(false);
    }
  }

  const anyBusy = busy || emailBusy || manualBusy;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] p-4 flex anim-fade"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        className="relative bg-card border border-line rounded-md w-full max-w-lg p-6 m-auto anim-pop"
      >
        <button
          type="button"
          aria-label="Close dialog"
          className="icon-btn absolute top-3 right-3"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <h3 id="offer-title" className="font-display text-[22px] font-semibold text-ink leading-tight pr-10">
          Offer details
        </h3>
        <p className="mini mt-1">
          {app.candidate_name} · {app.designation} · Grade {app.grade} · seat <b className="font-mono">{app.pcn}</b>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <div>
            <label className="lbl" htmlFor="offer-doj">Date of Joining <span className="text-brand-red">*</span></label>
            <input
              ref={firstRef}
              id="offer-doj"
              type="date"
              className="inp"
              value={dateOfJoining}
              onChange={(e) => setDateOfJoining(e.target.value)}
            />
          </div>
          <div>
            <label className="lbl" htmlFor="offer-salary">Offered Salary (₹/mo) <span className="text-brand-red">*</span></label>
            <input
              id="offer-salary"
              type="number"
              min="0"
              inputMode="numeric"
              className="inp"
              value={offeredSalary}
              onChange={(e) => setOfferedSalary(e.target.value)}
              placeholder={app.expected_salary ? `expected ${app.expected_salary}` : 'monthly CTC'}
            />
          </div>
        </div>

        <p className="hint">Both are printed on the offer letter, along with the seat and grade above.</p>

        {app.offer_sent_at && (
          <div className="bg-brand-green/8 border border-brand-green/40 rounded-sm px-3 py-2 mt-3 text-[12.5px] text-body">
            <span className="inline-flex items-start gap-1.5">
              <Check size={13} className="text-brand-green mt-px shrink-0" />
              <span>
                Offer letter{' '}
                <b>{app.offer_sent_method === 'manual' ? 'sent manually' : 'emailed by the system'}</b>
                {' '}to {app.offer_sent_to || app.email} on {fmtDate(app.offer_sent_at)}.
                {app.offer_sent_note && <> <span className="text-muted">{app.offer_sent_note}</span></>}
                {app.offer_sent_by_name && <div className="mini">Recorded by {app.offer_sent_by_name}</div>}
              </span>
            </span>
            {app.offer_sent_method === 'manual' && (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2"
                onClick={clearManual}
                disabled={anyBusy}
                title="Remove this record — use it if it was entered by mistake"
              >
                <Trash size={12} />
                Undo this record
              </button>
            )}
          </div>
        )}

        {/* Recording a send made outside the system */}
        {manualOpen && !app.offer_sent_at && (
          <div className="panel-box mt-3">
            <div className="panel-box-h">Record a letter you sent yourself</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <div>
                <label className="lbl" htmlFor="manual-on">Sent on</label>
                <input
                  id="manual-on"
                  type="date"
                  className="inp"
                  max={today}
                  value={sentOn}
                  onChange={(e) => setSentOn(e.target.value)}
                />
              </div>
              <div>
                <label className="lbl" htmlFor="manual-to">Sent to</label>
                <input
                  id="manual-to"
                  className="inp"
                  value={sentTo}
                  placeholder="email, phone, or in person"
                  onChange={(e) => setSentTo(e.target.value)}
                />
              </div>
            </div>
            <label className="lbl" htmlFor="manual-note">How (optional)</label>
            <input
              id="manual-note"
              className="inp"
              maxLength={300}
              value={sentNote}
              placeholder="e.g. Sent from the P&amp;C mailbox / handed over at reception"
              onChange={(e) => setSentNote(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap mt-3">
              <button type="button" className="btn btn-sm" onClick={recordManual} disabled={anyBusy}>
                {manualBusy ? 'Recording…' : 'Record as sent'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManualOpen(false)} disabled={anyBusy}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <ErrorBox error={err} />

        <div className="flex gap-2 flex-wrap items-center mt-5">
          <button type="button" className="btn btn-ghost btn-sm" onClick={preview} disabled={anyBusy}>
            <FileText size={13} />
            Preview / print
          </button>
          <button type="button" className="btn btn-sm" onClick={email} disabled={anyBusy}>
            <Mail size={13} />
            {emailBusy ? 'Sending…' : 'Email to candidate'}
          </button>
          {!app.offer_sent_at && !manualOpen && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setManualOpen(true)}
              disabled={anyBusy}
              title="You sent the letter yourself — record it so the register shows the offer as sent"
            >
              <Check size={13} />
              Mark as sent manually
            </button>
          )}
          <button type="button" className="btn ml-auto" onClick={save} disabled={anyBusy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
