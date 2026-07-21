import { useEffect, useRef } from 'react';
import { btnDanger, btnGhost, btnSm } from './ui';

/**
 * Styled confirm dialog (no native browser confirms): serif title, ghost
 * Cancel, danger Confirm. Closes on Escape and backdrop click, autofocuses
 * Cancel, and returns focus to the trigger on close.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        // Two-button dialog: keep Tab cycling inside the panel.
        const focusables = panelRef.current?.querySelectorAll('button');
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onMouseDown={onCancel} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="dialog-in relative bg-card border border-line rounded-sm w-full max-w-sm p-6"
      >
        <h2
          id="confirm-dialog-title"
          className="font-display text-xl font-semibold text-ink leading-tight"
        >
          {title}
        </h2>
        <div className="text-[13px] text-body mt-2">{children}</div>
        <div className="flex justify-end gap-2 mt-5">
          <button ref={cancelRef} className={`${btnGhost} ${btnSm}`} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`${btnDanger} ${btnSm}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
