import { useEffect, useRef } from 'react';
import { X } from './Icons';

export default function Modal({ onClose, children, maxWidth = 'max-w-3xl', labelledBy }) {
  const prevFocus = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevFocus.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4 flex anim-fade"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`bg-card border border-line rounded-md w-full ${maxWidth} p-6 m-auto relative anim-pop focus:outline-none`}
      >
        <button
          type="button"
          aria-label="Close dialog"
          className="icon-btn absolute top-3 right-3"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
