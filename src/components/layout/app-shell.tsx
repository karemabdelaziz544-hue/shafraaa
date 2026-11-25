'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { canAccessRoute } from '@/lib/rbac';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { Header } from '@/components/layout/header';
import { TopProgressBar } from '@/components/motion/top-progress-bar';
import { RouteTransition } from '@/components/motion/route-transition';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { PREFETCH_ROUTES } from '@/lib/motion';
import { ICON_TOKENS } from '@/lib/design-tokens';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isAuthChecking,
    isAuthenticated,
    isSupabaseConfigured,
    permissions,
    cloudError,
    syncError,
    clearSyncError,
    refreshFromCloud,
  } = useShop();

  const routeAllowed = canAccessRoute(pathname, permissions);

  // التحقق الفوري على مستوى الواجهة وإعادة التوجيه عند محاولة فتح مسار غير مصرح به
  useEffect(() => {
    if (isSupabaseConfigured && !isAuthChecking && isAuthenticated && !routeAllowed) {
      router.replace('/no-permission');
    }
  }, [isAuthChecking, isAuthenticated, isSupabaseConfigured, routeAllowed, router]);

  // تحميل استباقي خفيف للمسارات المصرح للمستخدم بفتحها فقط
  useEffect(() => {
    if (!isAuthenticated || pathname === '/login') return;
    const runPrefetch = () => {
      PREFETCH_ROUTES.forEach((route) => {
        if (route !== pathname && canAccessRoute(route, permissions)) {
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
  }, [isAuthenticated, pathname, permissions, router]);

  if (pathname === '/login') {
    return (
      <>
        <TopProgressBar />
        <main className="flex-1 min-h-screen flex items-center justify-center bg-canvas p-4 w-full">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </>
    );
  }

  if (isSupabaseConfigured && (isAuthChecking || !isAuthenticated || !routeAllowed)) {
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
            <div className="mb-4 p-3.5 rounded-2xl bg-danger-bg border border-danger-border text-danger-text text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
              <div className="flex items-start gap-2.5">
                <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-danger-text">مشكلة في الاتصال أو الحفظ بقاعدة بيانات Supabase</p>
                  <p className="text-danger-text/90 mt-0.5 break-words">{activeError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void refreshFromCloud()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-truffle text-truffle-ink font-bold hover:opacity-90 transition-opacity active:scale-95"
                >
                  <RefreshCw strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                  <span>إعادة الفحص</span>
                </button>
                {syncError && (
                  <button
                    type="button"
                    onClick={clearSyncError}
                    className="p-1.5 rounded-lg text-danger-text hover:bg-danger/10"
                    title="إغلاق التنبيه"
                  >
                    <X strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
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
