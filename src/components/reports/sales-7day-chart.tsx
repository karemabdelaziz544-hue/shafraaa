'use client';

import React from 'react';
import { m } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { MOTION_DURATIONS, MOTION_EASINGS } from '@/lib/motion';

interface DayPoint {
  date: string;
  label: string;
  total: number;
}

export function Sales7DayChart({
  days,
  maxDailySales,
}: {
  days: DayPoint[];
  maxDailySales: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold flex items-center justify-between w-full">
          <span>مبيعات آخر ٧ أيام (حركة المبيعات اليومية)</span>
          <Badge variant="accent">مباشر</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="h-44 flex items-end justify-between gap-2 sm:gap-6 pt-4 border-b-2 border-fantastic dark:border-line pb-2">
          {days.map((day, idx) => {
            const scaleY = Math.max(0.08, Math.min(1, day.total / maxDailySales));
            const isToday = idx === days.length - 1;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group">
                <span className="text-[10px] font-bold text-ink-strong opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatCurrency(day.total)}
                </span>
                <div className="w-full bg-surface-alt border border-divider rounded-xl h-32 flex items-end overflow-hidden p-1">
                  <m.div
                    initial={{ scaleY: 0, opacity: 0.4 }}
                    animate={{ scaleY, opacity: 1 }}
                    transition={{
                      duration: MOTION_DURATIONS.normal,
                      delay: Math.min(0.08, idx * 0.015),
                      ease: MOTION_EASINGS.standard,
                    }}
                    style={{ transformOrigin: 'bottom center' }}
                    className={
                      isToday
                        ? 'w-full h-full bg-flame border border-abyssal/20 rounded-lg transition-colors'
                        : 'w-full h-full bg-chart-bar hover:bg-flame/80 border border-line/60 rounded-lg transition-colors'
                    }
                  />
                </div>
                <span
                  className={
                    isToday
                      ? 'text-xs font-black text-ink-strong dark:text-flame'
                      : 'text-xs font-bold text-ink-muted'
                  }
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
