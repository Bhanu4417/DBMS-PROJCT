import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CheckCircle2, ring: 'border-success/40', tint: 'text-success' },
  error: { icon: AlertTriangle, ring: 'border-danger/40', tint: 'text-danger' },
  info: { icon: Info, ring: 'border-accentBlue/40', tint: 'text-accentBlue' },
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, type, message }]);
      window.setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const value = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex w-[min(22rem,calc(100vw-3rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const style = STYLES[toast.type] || STYLES.info;
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={`card flex items-start gap-3 border ${style.ring} px-4 py-3 text-sm`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${style.tint}`} />
              <p className="flex-1 leading-snug text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="text-muted transition hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
