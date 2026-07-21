import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle, AlertCircle } from '../components/Icons';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [type, setType] = useState('success'); // 'success' | 'error'
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  // toast('Saved') → success; toast('Nope', 'error') → error variant.
  const toast = useCallback((message, variant = 'success') => {
    setMsg(String(message));
    setType(variant === 'error' ? 'error' : 'success');
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 3400);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-cream pl-4 pr-5 py-2.5 rounded-full text-[13px] z-[99] pointer-events-none transition-opacity duration-200 max-w-[90vw] flex items-center gap-2 ${show ? 'opacity-100' : 'opacity-0'}`}
      >
        {type === 'error'
          ? <AlertCircle size={15} className="text-brand-red" />
          : <CheckCircle size={15} className="text-brand-green" />}
        <span className="text-left">{msg}</span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
