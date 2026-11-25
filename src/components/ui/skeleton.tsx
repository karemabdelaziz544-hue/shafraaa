import React from 'react';
import { cn } from './button';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-xl bg-oatmeal/55 animate-pulse motion-reduce:animate-none',
        className
      )}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="جاري تحميل لوحة التحكم">
      {/* بطاقة الترحيب */}
      <div className="rounded-3xl bg-oatmeal/45 border border-line p-6 sm:p-8 space-y-3 animate-pulse motion-reduce:animate-none">
        <Skeleton className="h-5 w-32 bg-oatmeal/80" />
        <Skeleton className="h-8 w-64 max-w-full bg-oatmeal/80" />
        <Skeleton className="h-4 w-96 max-w-full bg-oatmeal/60" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-12 w-36 rounded-xl bg-oatmeal/80" />
          <Skeleton className="h-12 w-32 rounded-xl bg-oatmeal/70" />
        </div>
      </div>

      {/* 4 بطاقات KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl border border-line p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* بطاقة تنبيه النواقص */}
      <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>

      {/* شبكة الإجراءات السريعة */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>

      {/* آخر العمليات */}
      <div className="bg-surface rounded-2xl border border-line p-4 space-y-3">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-t border-divider">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeletonRows({
  columns = 5,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="p-4 space-y-3" aria-busy="true" aria-label="جاري تحميل البيانات">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="grid gap-3 py-2.5 border-b border-divider last:border-b-0 items-center"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={cIdx === 0 ? 'h-4 w-4/5' : 'h-4 w-2/3'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TablePageSkeleton({
  columns = 5,
  rows = 6,
  showSummaryCards = false,
}: {
  columns?: number;
  rows?: number;
  showSummaryCards?: boolean;
}) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="جاري تحميل الصفحة">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {showSummaryCards && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-line p-4 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <div className="p-4 bg-surface-alt border-b border-line">
          <Skeleton className="h-4 w-48" />
        </div>
        <TableSkeletonRows columns={columns} rows={rows} />
      </div>
    </div>
  );
}

export function PosSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="جاري تحميل نقطة البيع">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-4">
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-line p-3.5 space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-full" />
                <div className="flex items-center justify-between pt-2 border-t border-divider">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-7 w-7 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-surface rounded-2xl border border-line p-4 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormReportSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="جاري التحميل">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-2xl border border-line p-5 space-y-2.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    </div>
  );
}
