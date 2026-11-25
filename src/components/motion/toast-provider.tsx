'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { MOTION_DURATIONS, MOTION_EASINGS, MOTION_DISTANCES } from '@/lib/motion';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  successToast: (message: string) => void;
  errorToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      setTimeout(() => {
        dismiss(id);
      }, 3400);
    },
    [dismiss]
  );

  const successToast = useCallback(
    (message: string) => showToast(message, 'success'),
    [showToast]
  );

  const errorToast = useCallback(
    (message: string) => showToast(message, 'error'),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, successToast, errorToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-20 lg:bottom-5 left-4 right-4 sm:right-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none no-print"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <m.div
              key={toast.id}
              initial={{ opacity: 0, y: MOTION_DISTANCES.toastSlideY, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{
                duration: MOTION_DURATIONS.fast,
                ease: MOTION_EASINGS.standard,
              }}
              role="status"
              className={`pointer-events-auto p-3.5 rounded-2xl shadow-xl border flex items-start gap-2.5 text-xs font-bold backdrop-blur-md ${
                toast.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-700 text-emerald-50'
                  : toast.type === 'error'
                  ? 'bg-rose-950/95 border-rose-700 text-rose-50'
                  : 'bg-slate-900/95 border-slate-700 text-slate-50'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-relaxed">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="p-0.5 rounded-md opacity-70 hover:opacity-100 transition-opacity"
                aria-label="إغلاق الإشعار"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
      successToast: () => {},
      errorToast: () => {},
    };
  }
  return ctx;
}
