'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { Header } from '@/components/layout/header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    isAuthChecking,
    isAuthenticated,
    isSupabaseConfigured,
    cloudError,
    syncError,
    clearSyncError,
    refreshFromCloud,
  } = useShop();

  if (pathname === '/login') {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-slate-50 p-4 w-full">
        {children}
      </main>
    );
  }

  if (isSupabaseConfigured && (isAuthChecking || !isAuthenticated)) {
    return (
      <div className="flex-1 min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center w-full">
        <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-brand-500/30 animate-pulse mb-4">
          ش
        </div>
        <p className="text-sm font-bold text-slate-800">جاري التحقق من جلسة الدخول...</p>
        <p className="text-xs text-slate-500 mt-1">نظام إدارة محل شفرة</p>
      </div>
    );
  }

  const activeError = syncError || cloudError;

  return (
    <>
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors"
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
          {children}
        </main>
      </div>

      {/* شريط التنقل السفلي للهواتف الذكية */}
      <MobileBottomNav />
    </>
  );
}
