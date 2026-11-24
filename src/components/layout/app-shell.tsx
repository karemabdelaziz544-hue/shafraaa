'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useShop } from '@/lib/store/shop-store';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { Header } from '@/components/layout/header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthChecking, isAuthenticated, isSupabaseConfigured } = useShop();

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

  return (
    <>
      {/* الشريط الجانبي للشاشات الكبيرة */}
      <DesktopSidebar />

      {/* الحاوية الرئيسية للتطبيق */}
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-6 overflow-x-hidden">
        <Header />
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* شريط التنقل السفلي للهواتف الذكية */}
      <MobileBottomNav />
    </>
  );
}
