import { useEffect, useRef } from 'react';

// Styled replacement for the native browser confirm: serif title, body copy,
// ghost Cancel + solid danger/primary Confirm. Escape/backdrop dismiss,
// focus moves in on open and returns to the trigger on close.
export default function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'danger', // 'danger' | 'primary'
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const prevFocus = useRef(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    cancelRef.current?.focus(); // safe default for destructive dialogs
    return () => prevFocus.current?.focus?.();
  }, []);

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
    if (e.key === 'Tab') {
      // two-stop focus trap; stopPropagation keeps a parent Drawer/Modal trap out of it
      e.preventDefault();
      e.stopPropagation();
      (document.activeElement === confirmRef.current ? cancelRef : confirmRef).current?.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[70] p-4 flex anim-fade"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={onKeyDown}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="bg-card border border-line rounded-md w-full max-w-md p-6 m-auto anim-pop"
      >
        <h3 className="font-display text-[22px] font-semibold text-ink leading-tight">{title}</h3>
        <div className="text-[13px] text-body mt-2">{body}</div>
        <div className="flex gap-2 justify-end mt-6 flex-wrap">
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-red' : ''}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
