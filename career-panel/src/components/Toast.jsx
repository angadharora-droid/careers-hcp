import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircleIcon, CheckCircleIcon } from './Icons';

const ToastContext = createContext(() => {});

/** const toast = useToast(); toast('Saved', 'success' | 'error') */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, variant = 'success') => {
    setToast({ message, variant, key: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4"
      >
        {toast && (
          <div
            key={toast.key}
            className="toast-enter flex items-center gap-2.5 bg-footer text-cream rounded-sm px-5 py-3 text-[13px] font-medium shadow-none"
          >
            {toast.variant === 'error' ? (
              <AlertCircleIcon size={16} className="shrink-0 text-brand-red" />
            ) : (
              <CheckCircleIcon size={16} className="shrink-0 text-brand-green" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
