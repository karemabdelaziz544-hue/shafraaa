'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from './button';
import { MODAL_BACKDROP_TRANSITION, MODAL_PANEL_TRANSITION } from '@/lib/motion';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}: DialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const maxW = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          key="dialog-backdrop"
          initial={MODAL_BACKDROP_TRANSITION.initial}
          animate={MODAL_BACKDROP_TRANSITION.animate}
          exit={MODAL_BACKDROP_TRANSITION.exit}
          transition={MODAL_BACKDROP_TRANSITION.transition}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <m.div
            key="dialog-panel"
            initial={MODAL_PANEL_TRANSITION.initial}
            animate={MODAL_PANEL_TRANSITION.animate}
            exit={MODAL_PANEL_TRANSITION.exit}
            transition={MODAL_PANEL_TRANSITION.transition}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col',
              maxW
            )}
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">{title}</h3>
                {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
