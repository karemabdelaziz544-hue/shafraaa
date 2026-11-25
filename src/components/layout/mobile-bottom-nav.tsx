'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, m } from 'framer-motion';
import { Home, ShoppingCart, Package, Vault, Menu, X } from 'lucide-react';
import { cn } from '@/components/ui/button';
import { NAV_ITEMS } from './desktop-sidebar';
import { useShop } from '@/lib/store/shop-store';
import type { PermissionKey } from '@/lib/rbac';
import {
  MODAL_BACKDROP_TRANSITION,
  MOTION_DISTANCES,
  MOTION_DURATIONS,
  MOTION_EASINGS,
} from '@/lib/motion';
import { ICON_TOKENS } from '@/lib/design-tokens';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { can } = useShop();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const quickNav: Array<{
    href: string;
    label: string;
    icon: typeof Home;
    permission: PermissionKey;
    highlight?: boolean;
  }> = [
    { href: '/', label: 'الرئيسية', icon: Home, permission: 'dashboard.view' },
    { href: '/sales/new', label: 'بيع جديد', icon: ShoppingCart, permission: 'pos.view', highlight: true },
    { href: '/products', label: 'المنتجات', icon: Package, permission: 'products.view' },
    { href: '/drawer', label: 'الدرج', icon: Vault, permission: 'drawer.view' },
  ];

  const visibleQuickNav = quickNav.filter((item) => can(item.permission));
  const visibleAllNav = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <>
      {/* نافذة "المزيد" المنبثقة المتحركة على الموبايل */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <m.div
            key="mobile-drawer-backdrop"
            initial={MODAL_BACKDROP_TRANSITION.initial}
            animate={MODAL_BACKDROP_TRANSITION.animate}
            exit={MODAL_BACKDROP_TRANSITION.exit}
            transition={MODAL_BACKDROP_TRANSITION.transition}
            className="fixed inset-0 z-40 bg-abyssal/65 backdrop-blur-sm lg:hidden flex flex-col justify-end"
            onClick={() => setIsMoreMenuOpen(false)}
          >
            <m.div
              key="mobile-drawer-sheet"
              initial={{ opacity: 0, y: MOTION_DISTANCES.sheetSlideY }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: MOTION_DISTANCES.sheetSlideY }}
              transition={{
                duration: MOTION_DURATIONS.modal,
                ease: MOTION_EASINGS.standard,
              }}
              className="bg-surface text-ink rounded-t-3xl border-t border-line p-5 shadow-elevated max-h-[75vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-divider">
                <h3 className="font-bold text-ink-strong text-base">الأقسام المتاحة لك</h3>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(false)}
                  aria-label="إغلاق القائمة"
                  className="p-1.5 rounded-full text-ink-muted hover:text-ink-strong hover:bg-oatmeal/45 active:scale-95"
                >
                  <X strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-6">
                {visibleAllNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 p-3 rounded-xl text-sm font-semibold border transition-[transform,background-color,border-color] duration-150 active:scale-[0.97]',
                        isActive
                          ? 'bg-flame border-flame text-abyssal font-bold'
                          : 'bg-surface-alt border-line text-ink hover:bg-oatmeal/55'
                      )}
                    >
                      <Icon
                        strokeWidth={ICON_TOKENS.strokeWidth}
                        className={cn(
                          'w-4 h-4 shrink-0',
                          isActive ? 'text-abyssal' : 'text-truffle dark:text-flame'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* الشريط السفلي الثابت لشاشات الهواتف */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line shadow-elevated px-2 py-1 flex items-center justify-around h-16 select-none no-print">
        {visibleQuickNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className="relative -top-3 flex flex-col items-center group"
              >
                <div className="w-14 h-14 rounded-full bg-flame text-abyssal shadow-accent flex items-center justify-center transition-transform duration-150 active:scale-95 border-2 border-surface">
                  <Icon strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-ink-strong mt-0.5">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 rounded-xl transition-all duration-150 active:scale-95',
                isActive ? 'text-ink-strong font-bold bg-flame/20' : 'text-ink-muted hover:text-ink-strong'
              )}
            >
              <Icon
                strokeWidth={ICON_TOKENS.strokeWidth}
                className={cn('w-5 h-5 mb-1', isActive ? 'text-truffle dark:text-flame' : '')}
              />
              <span className="text-[10px] truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* زر المزيد */}
        <button
          type="button"
          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 active:scale-95 text-ink-muted hover:text-ink-strong"
        >
          <Menu strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 mb-1" />
          <span className="text-[10px]">المزيد</span>
        </button>
      </nav>
    </>
  );
}
