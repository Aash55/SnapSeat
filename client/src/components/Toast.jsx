import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const ToastItem = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bgColor = {
    success: 'bg-success/20 border-success/50 text-success',
    error: 'bg-danger/20 border-danger/50 text-danger',
    warning: 'bg-warning/20 border-warning/50 text-warning',
    info: 'bg-gold/20 border-gold/50 text-gold',
  }[toast.type] || 'bg-gold/20 border-gold/50 text-gold';

  return (
    <div className={`px-4 py-3 rounded-lg border ${bgColor} text-sm shadow-lg animate-[slideIn_0.3s_ease-out]`}>
      {toast.message}
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* top-20, not top-4 — every page has a ~72px fixed header, and a toast pinned at
          top-4 sat right on top of the navbar's user info / logout button, unreadable
          and overlapping (see the bug report). top-20 clears the header on every page.
          Bottom-right was considered and rejected: the seat-map page has its own fixed
          bottom action bar, and a toast there would sit on top of its "Hold Selected
          Seats" button instead. */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
