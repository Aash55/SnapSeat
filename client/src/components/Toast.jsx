import { useCallback, useEffect, useMemo, useState } from 'react';
import { ToastContext } from './toastContext';

const STYLES = {
  success: { ring: 'border-success/45', icon: 'text-success bg-success/15', path: 'M5 12.5l4.5 4.5L19 7.5' },
  error: { ring: 'border-danger/45', icon: 'text-danger bg-danger/15', path: 'M12 8v5M12 16v.01' },
  warning: { ring: 'border-[#5A4220]', icon: 'text-gold bg-gold/15', path: 'M12 9v4M12 17h.01' },
  info: { ring: 'border-dark-border-hover', icon: 'text-gold bg-gold/15', path: 'M12 8h.01M12 11v5' },
};

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const s = STYLES[toast.type] || STYLES.info;
  return (
    <div role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
      className={`toast-drop pointer-events-auto w-full flex items-start gap-3 p-3.5 pl-4 rounded-[14px] bg-[#1D1A25] border ${s.ring} shadow-[0_24px_48px_-16px_rgba(0,0,0,.85)]`}>
      <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${s.icon}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={s.path} /></svg>
      </span>
      <div className="flex-grow min-w-0 flex flex-col gap-0.5 pt-1">
        {toast.title && <span className="text-[15px] font-bold leading-snug">{toast.title}</span>}
        <span className={toast.title ? 'text-sm leading-normal text-gray-text' : 'text-sm font-semibold leading-snug'}>{toast.message}</span>
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => onRemove(toast.id)}
        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-gray-text hover:text-white hover:bg-dark-card-hover cursor-pointer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  // Stable object: pages list `toast` in hook dependencies, so a new object every render would
  // re-run their data loads each time a toast appears (and loop when the load itself fails).
  const toast = useMemo(() => {
    const add = (type) => (message, opts = {}) => {
      const id = `${Date.now()}-${Math.random()}`;
      const t = { id, type, message, title: opts.title, duration: opts.duration || (type === 'error' || type === 'warning' ? 6000 : 4000) };
      // Same message twice in a row replaces the first instead of stacking.
      setToasts((prev) => [...prev.filter((p) => p.message !== message).slice(-2), t]);
      return id;
    };
    return { success: add('success'), error: add('error'), warning: add('warning'), info: add('info'), dismiss: remove };
  }, [remove]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Below the 72px header, centred like the design's conflict toast. */}
      <div aria-live="polite" className="fixed top-[84px] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(520px,calc(100vw-32px))] pointer-events-none">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onRemove={remove} />)}
      </div>
    </ToastContext.Provider>
  );
};
