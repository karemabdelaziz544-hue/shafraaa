'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { m } from 'framer-motion';
import { ROUTE_TRANSITION } from '@/lib/motion';

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <m.div
      key={pathname}
      initial={ROUTE_TRANSITION.initial}
      animate={ROUTE_TRANSITION.animate}
      transition={ROUTE_TRANSITION.transition}
      className="w-full"
    >
      {children}
    </m.div>
  );
}
