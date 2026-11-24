'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Lock, Clock, LogOut } from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatArabicDate } from '@/lib/formatters';

export function Header() {
  const { activeDrawer, ownerName, shopName, isAuthenticated, isSupabaseConfigured, signOut } =
    useShop();

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
      {/* الترحيب بالمالك وتاريخ اليوم */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
              أهلًا يا {ownerName} 👋
            </h2>
            <Badge variant="info" className="hidden sm:inline-flex shrink-0">
              {shopName}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{formatArabicDate(new Date())}</span>
          </p>
        </div>
      </div>

      {/* حالة الدرج وزر البيع السريع وتسجيل الخروج */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* شارة حالة الدرج */}
        <Link href="/drawer">
          {activeDrawer ? (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>الدرج مفتوح</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>الدرج مقفل</span>
            </div>
          )}
        </Link>

        {/* زر فاتورة جديدة */}
        <Link href="/sales/new">
          <Button variant="primary" size="md" className="hidden sm:inline-flex">
            <Plus className="w-4 h-4" />
            <span>فاتورة بيع</span>
          </Button>
        </Link>

        {/* زر تسجيل الخروج */}
        {isSupabaseConfigured && isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            title="تسجيل الخروج"
            className="text-slate-600 hover:text-rose-600 hover:border-rose-200 gap-1 px-2.5 h-9"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline text-xs font-bold">خروج</span>
          </Button>
        )}
      </div>
    </header>
  );
}
