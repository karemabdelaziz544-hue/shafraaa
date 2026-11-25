'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { m, useReducedMotion } from 'framer-motion';
import { MOTION_DURATIONS, MOTION_EASINGS } from '@/lib/motion';

export function TopProgressBar() {
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();
  const [state, setState] = useState<'idle' | 'loading' | 'finishing'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef(pathname);

  // رصد النقرات على الروابط الداخلية لإظهار شريط التقدم فوراً
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      if (anchor.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (href.split('?')[0] === pathname) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      setState('loading');
      // إغلاق أمان تلقائي في حال لم تتغير الصفحة
      timerRef.current = setTimeout(() => {
        setState('idle');
      }, 2500);
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  // إتمام الشريط عند اكتمال الانتقال للمسار الجديد
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (timerRef.current) clearTimeout(timerRef.current);
      setState('finishing');
      timerRef.current = setTimeout(() => {
        setState('idle');
      }, 200);
    }
  }, [pathname]);

  if (state === 'idle') return null;

  const scaleX = state === 'loading' ? 0.72 : 1;
  const opacity = state === 'finishing' ? 0 : 1;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none no-print overflow-hidden"
    >
      <m.div
        initial={{ scaleX: 0.12, opacity: 1 }}
        animate={{ scaleX, opacity }}
        transition={{
          duration: prefersReduced ? 0.01 : MOTION_DURATIONS.progress,
          ease: MOTION_EASINGS.standard,
        }}
        style={{ transformOrigin: 'right center' }}
        className="h-full w-full bg-gradient-to-l from-brand-500 via-brand-400 to-sky-400 shadow-sm shadow-brand-500/40"
      />
    </div>
  );
}
