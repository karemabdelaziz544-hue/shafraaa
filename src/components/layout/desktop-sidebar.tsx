'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ShoppingCart,
  ScrollText,
  Package,
  Users,
  Truck,
  Boxes,
  Receipt,
  Vault,
  BarChart3,
  WalletCards,
  FileSpreadsheet,
  Settings,
  AlertOctagon,
  ShieldCheck,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/components/ui/button';
import { useShop } from '@/lib/store/shop-store';
import { ROLE_LABELS, type PermissionKey } from '@/lib/rbac';
import { ICON_TOKENS } from '@/lib/design-tokens';

export interface NavItemConfig {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
  highlight?: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { href: '/', label: 'الرئيسية', icon: Home, permission: 'dashboard.view' },
  { href: '/sales/new', label: 'فاتورة بيع (POS)', icon: ShoppingCart, permission: 'pos.view', highlight: true },
  { href: '/sales', label: 'سجل الفواتير والمرتجع', icon: ScrollText, permission: 'sales.view' },
  { href: '/products', label: 'المنتجات والأسعار', icon: Package, permission: 'products.view' },
  { href: '/customers', label: 'العملاء والديون', icon: Users, permission: 'customers.view' },
  { href: '/suppliers', label: 'الموردين والمشتريات', icon: Truck, permission: 'suppliers.view' },
  { href: '/inventory', label: 'المخزون والجرد', icon: Boxes, permission: 'inventory.view' },
  { href: '/inventory/damaged', label: 'الهالك والتوالف', icon: AlertOctagon, permission: 'inventory.view' },
  { href: '/expenses', label: 'المصروفات', icon: Receipt, permission: 'expenses.view' },
  { href: '/drawer', label: 'تقفيل الدرج اليومي', icon: Vault, permission: 'drawer.view' },
  { href: '/reports', label: 'التقارير والأرباح', icon: BarChart3, permission: 'reports.view' },
  { href: '/withdrawals', label: 'مسحوبات المالك', icon: WalletCards, permission: 'withdrawals.view' },
  { href: '/import', label: 'استيراد شيت إكسيل', icon: FileSpreadsheet, permission: 'import.view' },
  { href: '/users', label: 'المستخدمون والصلاحيات', icon: ShieldCheck, permission: 'users.manage' },
  { href: '/audit-log', label: 'سجل التدقيق', icon: ClipboardList, permission: 'audit.view' },
  { href: '/settings', label: 'الإعدادات والنسخ', icon: Settings, permission: 'settings.view' },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const {
    shopName,
    currentUserName,
    ownerName,
    userRole,
    can,
    isSupabaseConfigured,
    isAuthenticated,
    signOut,
  } = useShop();

  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission));
  const displayName = currentUserName || ownerName;

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-fantastic text-palladian border-l border-abyssal h-screen sticky top-0 select-none no-print">
      {/* رأس الشريط الجانبي */}
      <div className="p-5 border-b border-abyssal/60 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-flame flex items-center justify-center text-abyssal font-black text-xl shadow-accent shrink-0">
            {shopName.replace(/^محل\s+/, '').trim().slice(0, 1) || 'ش'}
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-palladian text-base truncate">{shopName}</h1>
            <p className="text-xs text-oatmeal">إدارة التجزئة الذكية</p>
          </div>
        </div>
      </div>

      {/* روابط التنقل المفلترة حسب الصلاحيات */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.98] group',
                isActive
                  ? 'bg-gradient-to-l from-flame/15 via-flame/10 to-transparent border-r-[3px] border-flame text-flame font-bold'
                  : 'text-truffle-ink hover:bg-abyssal/45 hover:text-flame',
                item.highlight && !isActive && 'text-flame bg-abyssal/40 border border-flame/25 hover:bg-abyssal/70'
              )}
            >
              <Icon
                strokeWidth={ICON_TOKENS.strokeWidth}
                className={cn(
                  'w-5 h-5 shrink-0 transition-transform group-hover:scale-105',
                  isActive
                    ? 'text-flame'
                    : item.highlight
                    ? 'text-flame'
                    : 'text-oatmeal group-hover:text-flame'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ملف المستخدم في الأسفل */}
      <div className="p-4 border-t border-abyssal/70 bg-abyssal/55">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-fantastic border border-oatmeal/35 flex items-center justify-center font-bold text-palladian shrink-0">
            {displayName.slice(0, 1) || 'ك'}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-bold text-palladian truncate">
              {displayName} ({ROLE_LABELS[userRole]})
            </p>
            <p className="text-xs text-flame flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-flame animate-pulse inline-block" />
              {isSupabaseConfigured ? 'متصل بالسحابة' : 'وضع محلي'}
            </p>
          </div>
        </div>
        {isSupabaseConfigured && isAuthenticated && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 w-full py-1.5 px-3 rounded-lg bg-fantastic hover:bg-truffle hover:text-truffle-ink text-xs font-semibold text-palladian/90 border border-oatmeal/20 transition-colors text-center"
          >
            تسجيل الخروج
          </button>
        )}
      </div>
    </aside>
  );
}
