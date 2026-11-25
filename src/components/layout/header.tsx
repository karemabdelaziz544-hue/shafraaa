'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Lock, Clock, LogOut, Sun, Moon } from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { useTheme } from '@/components/layout/theme-provider';
import { ROLE_LABELS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatArabicDate } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

export function Header() {
  const {
    activeDrawer,
    currentUserName,
    ownerName,
    userRole,
    can,
    isAuthenticated,
    isSupabaseConfigured,
    signOut,
  } = useShop();
  const { theme, toggleTheme } = useTheme();

  const displayName = currentUserName || ownerName;

  const drawerBadge = activeDrawer ? (
    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-success-bg border border-success-border text-success text-xs font-bold">
      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
      <span>الدرج مفتوح</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-warning-bg border border-warning-border text-warning text-xs font-bold">
      <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 text-warning" />
      <span>الدرج مقفل</span>
    </div>
  );

  return (
    <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-2 no-print">
      {/* الترحيب بالمستخدم وتاريخ اليوم */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-ink-strong truncate">
              أهلًا يا {displayName}
            </h2>
            <Badge variant="info" className="hidden sm:inline-flex shrink-0">
              {ROLE_LABELS[userRole]}
            </Badge>
          </div>
          <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5 truncate">
            <Clock strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 text-ink-muted shrink-0" />
            <span className="truncate">{formatArabicDate(new Date())}</span>
          </p>
        </div>
      </div>

      {/* حالة الدرج، المظهر، البيع السريع، وتسجيل الخروج */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {can('drawer.view') ? (
          <Link href="/drawer" className="hover:opacity-90 transition-opacity cursor-pointer">
            {drawerBadge}
          </Link>
        ) : (
          drawerBadge
        )}

        {/* زر تبديل الوضع الفاتح / الداكن */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
          aria-label={theme === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
          className="px-2.5 h-9"
        >
          {theme === 'dark' ? (
            <Sun strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-flame" />
          ) : (
            <Moon strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink" />
          )}
        </Button>

        {/* زر فاتورة جديدة (يظهر فقط لمن يملك صلاحية نقطة البيع) */}
        {can('pos.view') && can('pos.create') && (
          <Link href="/sales/new">
            <Button variant="primary" size="md" className="hidden sm:inline-flex">
              <Plus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
              <span>فاتورة بيع</span>
            </Button>
          </Link>
        )}

        {/* زر تسجيل الخروج */}
        {isSupabaseConfigured && isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void signOut()}
            title="تسجيل الخروج"
            className="text-ink hover:text-danger-text hover:border-danger-border gap-1 px-2.5 h-9"
          >
            <LogOut strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
            <span className="hidden md:inline text-xs font-bold">خروج</span>
          </Button>
        )}
      </div>
    </header>
  );
}
