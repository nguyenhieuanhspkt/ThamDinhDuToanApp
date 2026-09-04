import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Info, X, AlertTriangle } from 'lucide-react';

// ── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur ?? 5000),
    info:    (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Single Toast Item ─────────────────────────────────────────────────────────
const STYLES = {
  success: { bg: 'bg-emerald-50 border-emerald-400', text: 'text-emerald-800', icon: <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> },
  error:   { bg: 'bg-red-50 border-red-400',         text: 'text-red-800',     icon: <XCircle className="w-4 h-4 text-red-600 shrink-0" /> },
  warning: { bg: 'bg-amber-50 border-amber-400',     text: 'text-amber-800',   icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> },
  info:    { bg: 'bg-blue-50 border-blue-400',       text: 'text-blue-800',    icon: <Info className="w-4 h-4 text-blue-600 shrink-0" /> },
};

function ToastItem({ toast, onRemove }) {
  const s = STYLES[toast.type] || STYLES.info;
  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-lg max-w-sm text-sm font-medium ${s.bg} ${s.text} animate-[fadeInUp_0.2s_ease]`}
      role="alert"
    >
      {s.icon}
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-1 opacity-50 hover:opacity-100 transition shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
