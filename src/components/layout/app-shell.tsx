'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { Header } from '@/components/layout/header';
import { TopProgressBar } from '@/components/motion/top-progress-bar';
import { RouteTransition } from '@/components/motion/route-transition';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { PREFETCH_ROUTES } from '@/lib/motion';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isAuthChecking,
    isAuthenticated,
    isSupabaseConfigured,
    cloudError,
    syncError,
    clearSyncError,
    refreshFromCloud,
  } = useShop();

  // تحميل استباقي خفيف للمسارات الرئيسية في الخلفية لسرعة التنقل على الهواتف
  useEffect(() => {
    if (!isAuthenticated || pathname === '/login') return;
    const runPrefetch = () => {
      PREFETCH_ROUTES.forEach((route) => {
        if (route !== pathname) {
          router.prefetch(route);
        }
      });
    };

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(runPrefetch);
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = setTimeout(runPrefetch, 450);
    return () => clearTimeout(timer);
  }, [isAuthenticated, pathname, router]);

  if (pathname === '/login') {
    return (
      <>
        <TopProgressBar />
        <main className="flex-1 min-h-screen flex items-center justify-center bg-slate-50 p-4 w-full">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </>
    );
  }

  if (isSupabaseConfigured && (isAuthChecking || !isAuthenticated)) {
    return (
      <>
        <TopProgressBar />
        <div className="flex-1 min-h-screen p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <DashboardSkeleton />
        </div>
      </>
    );
  }

  const activeError = syncError || cloudError;

  return (
    <>
      <TopProgressBar />

      {/* الشريط الجانبي للشاشات الكبيرة */}
      <DesktopSidebar />

      {/* الحاوية الرئيسية للتطبيق */}
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-6 overflow-x-hidden">
        <Header />
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeError && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-rose-900">مشكلة في الاتصال أو الحفظ بقاعدة بيانات Supabase</p>
                  <p className="text-rose-700 mt-0.5 break-words">{activeError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void refreshFromCloud()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة الفحص</span>
                </button>
                {syncError && (
                  <button
                    type="button"
                    onClick={clearSyncError}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100"
                    title="إغلاق التنبيه"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>

      {/* شريط التنقل السفلي للهواتف الذكية */}
      <MobileBottomNav />
    </>
  );
}
