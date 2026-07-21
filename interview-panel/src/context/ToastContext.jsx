import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { IconAlertCircle, IconCheckCircle } from '../components/Icons';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toastState, setToastState] = useState({ msg: '', variant: 'success' });
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);

  /** toast(message, variant?) — variant: 'success' (default) | 'error'. */
  const toast = useCallback((message, variant = 'success') => {
    setToastState({ msg: message, variant });
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 3400);
  }, []);

  const isError = toastState.variant === 'error';

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-cream pl-4 pr-5 py-2.5 rounded-full text-[13px] pointer-events-none transition-opacity duration-200 max-w-[90vw] flex items-center gap-2 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {toastState.msg !== '' &&
          (isError ? (
            <IconAlertCircle className="shrink-0 text-[#ff9d91]" />
          ) : (
            <IconCheckCircle className="shrink-0 text-[#8fd6a8]" />
          ))}
        <span>{toastState.msg}</span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
