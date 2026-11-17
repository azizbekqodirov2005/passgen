import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconAlert, IconCheck, IconClose } from '@/components/icons';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const LIFETIME_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, 'id'>) => {
      const id = `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current.slice(-3), { ...input, id }]);
      const timer = window.setTimeout(() => dismiss(id), LIFETIME_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // Clear pending timers on unmount so nothing fires into a dead tree.
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, detail) => toast({ kind: 'success', title, ...(detail ? { detail } : {}) }),
      error: (title, detail) => toast({ kind: 'error', title, ...(detail ? { detail } : {}) }),
      info: (title, detail) => toast({ kind: 'info', title, ...(detail ? { detail } : {}) }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.kind}`}>
            {item.kind === 'success' ? (
              <IconCheck size={16} className="u-dim" />
            ) : (
              <IconAlert size={16} className="u-dim" />
            )}
            <div className="toast__text">
              <div className="toast__title">{item.title}</div>
              {item.detail ? <div className="toast__detail">{item.detail}</div> : null}
            </div>
            <button
              type="button"
              className="btn btn--icon btn--sm"
              onClick={() => dismiss(item.id)}
              aria-label="Bildirishnomani yopish"
            >
              <IconClose size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
