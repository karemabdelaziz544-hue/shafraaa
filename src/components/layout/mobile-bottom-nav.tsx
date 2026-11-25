'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, m } from 'framer-motion';
import { Home, ShoppingCart, Package, Vault, Menu, X } from 'lucide-react';
import { cn } from '@/components/ui/button';
import { NAV_ITEMS } from './desktop-sidebar';
import {
  MODAL_BACKDROP_TRANSITION,
  MOTION_DISTANCES,
  MOTION_DURATIONS,
  MOTION_EASINGS,
} from '@/lib/motion';

export function MobileBottomNav() {
  const pathname = usePathname();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // الأزرار الـ 4 الرئيسية على الموبايل + زر المزيد
  const quickNav = [
    { href: '/', label: 'الرئيسية', icon: Home },
    { href: '/sales/new', label: 'بيع جديد', icon: ShoppingCart, highlight: true },
    { href: '/products', label: 'المنتجات', icon: Package },
    { href: '/drawer', label: 'الدرج', icon: Vault },
  ];

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
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden flex flex-col justify-end"
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
              className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[75vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">جميع أقسام المحل</h3>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(false)}
                  aria-label="إغلاق القائمة"
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-6">
                {NAV_ITEMS.map((item) => {
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
                          ? 'bg-brand-50 border-brand-300 text-brand-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      <Icon className="w-4 h-4 text-brand-600 shrink-0" />
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1 flex items-center justify-around h-16 select-none no-print">
        {quickNav.map((item) => {
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
                <div className="w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-500/40 flex items-center justify-center transition-transform duration-150 active:scale-95">
                  <Icon className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold text-brand-700 mt-0.5">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 active:scale-95',
                isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* زر المزيد */}
        <button
          type="button"
          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 active:scale-95 text-slate-500 hover:text-slate-800'
          )}
        >
          <Menu className="w-5 h-5 mb-1" />
          <span className="text-[10px]">المزيد</span>
        </button>
      </nav>
    </>
  );
}
