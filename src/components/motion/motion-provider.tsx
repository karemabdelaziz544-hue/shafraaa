'use client';

import React from 'react';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';
import { ToastProvider } from './toast-provider';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
