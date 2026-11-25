'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { MOTION_DURATIONS } from '@/lib/motion';
import { formatCurrency } from '@/lib/formatters';

interface AnimatedNumberProps {
  value: number;
  formatter?: (val: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  formatter = formatCurrency,
  className,
}: AnimatedNumberProps) {
  const prefersReduced = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = Number(value) || 0;
    prevValueRef.current = endVal;

    if (prefersReduced || startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    const durationMs = MOTION_DURATIONS.countUp * 1000;
    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(startVal + (endVal - startVal) * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(endVal);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, prefersReduced]);

  return <span className={className}>{formatter(displayValue)}</span>;
}
