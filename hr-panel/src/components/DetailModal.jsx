import { useEffect, useRef } from 'react';
import { X } from './Icons';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Centered shell for detail dialogs — capped width/height, breathing room on every
// edge. Unlike Modal, it adds no padding: children own the layout (fixed header /
// scrolling body / sticky footer), and the body needs `flex-1 min-h-0 overflow-y-auto`
// to scroll within the cap. Escape + backdrop close, focus trap, focus returns.
export default function DetailModal({ onClose, children, labelledBy, maxWidth = 'max-w-[860px]' }) {
  const panelRef = useRef(null);
  const prevFocus = useRef(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    panelRef.current?.focus();
    return () => prevFocus.current?.focus?.();
  }, []);

  function onKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key !== 'Tab') return;
    const els = panelRef.current?.querySelectorAll(FOCUSABLE);
    if (!els || !els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex p-4 sm:p-6 anim-fade"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative bg-card border border-line rounded-md w-full ${maxWidth} max-h-full m-auto flex flex-col overflow-hidden anim-pop focus:outline-none`}
      >
        <button
          type="button"
          aria-label="Close dialog"
          className="icon-btn absolute top-3 right-3 z-10 bg-card"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
