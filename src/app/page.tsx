'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Vault,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Boxes,
  ChevronLeft,
  Users,
  Truck,
  Sparkles,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function HomePage() {
  const {
    ownerName,
    products,
    customers,
    suppliers,
    salesInvoices,
    expenses,
    activeDrawer,
    isInitialLoading,
  } = useShop();

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  // تصفية حركات اليوم
  const todayStr = new Date().toISOString().split('T')[0];

  const todaySalesInvoices = salesInvoices.filter((inv) => inv.createdAt.startsWith(todayStr));
  const todaySalesTotal = todaySalesInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const todayGrossProfit = todaySalesInvoices.reduce((sum, inv) => sum + inv.grossProfit, 0);

  const todayExpenses = expenses.filter((e) => e.date === todayStr);
  const todayExpensesTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // نقدية الدرج الحالية المتوقعة
  const currentDrawerCash = activeDrawer ? activeDrawer.expectedCash : 0;

  // 1. التنبيهات الذكية
  const lowStockProducts = products.filter((p) => p.currentStock <= p.minStockAlert);
  const overCreditCustomers = customers.filter(
    (c) => c.creditLimit > 0 && c.currentBalance > c.creditLimit
  );
  const owedSuppliers = suppliers.filter((s) => s.owedBalance > 0);
  const totalSuppliersOwed = owedSuppliers.reduce((sum, s) => sum + s.owedBalance, 0);

  // آخر العمليات
  const recentActivities = [
    ...salesInvoices.slice(0, 5).map((inv) => ({
      id: inv.id,
      title: `فاتورة بيع #${inv.invoiceNumber}`,
      subtitle: `${inv.customerName} (${inv.items.length} أصناف)`,
      amount: inv.totalAmount,
      type: 'sale',
      time: inv.createdAt,
    })),
    ...expenses.slice(0, 3).map((exp) => ({
      id: exp.id,
      title: `مصروف: ${exp.category}`,
      subtitle: exp.type === 'fixed' ? 'مصروف ثابت' : 'مصروف متغير',
      amount: exp.amount,
      type: 'expense',
      time: exp.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* بطاقة الترحيب العريضة الخاصة بالمالك كريم */}
      <div className="bg-gradient-to-l from-abyssal via-fantastic to-fantastic rounded-3xl p-6 sm:p-8 text-palladian shadow-elevated border border-oatmeal/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-flame/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-abyssal/45 border border-flame/30 text-xs font-semibold text-palladian">
              <Sparkles strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 text-flame" />
              <span>لوحة التحكم الكاملة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-palladian">
              أهلًا يا {ownerName}، يوم موفق في تجارتك!
            </h1>
            <p className="text-sm sm:text-base text-oatmeal max-w-xl">
              كل عمليات محلك تحت سيطرتك المباشرة: مبيعات، تكلفة حقيقية، مخزون دقيق، وتقفيل الدرج بالجنيه المصري.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/sales/new">
              <Button size="xl" variant="primary" className="shadow-accent font-bold">
                <ShoppingCart strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
                <span>فاتورة بيع سريعة</span>
              </Button>
            </Link>
            <Link href="/drawer">
              <Button
                size="xl"
                variant="outline"
                className="border-oatmeal/40 bg-abyssal/40 text-palladian hover:bg-abyssal/75 hover:border-flame font-semibold"
              >
                <Vault strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-flame" />
                <span>{activeDrawer ? 'إدارة الدرج' : 'فتح الوردية'}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* المؤشرات المالية الرئيسية الأربعة (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* 1. مبيعات اليوم */}
        <Card className="hover:border-flame transition-colors">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">مبيعات اليوم</span>
              <div className="w-9 h-9 rounded-xl bg-flame/25 text-abyssal dark:text-flame flex items-center justify-center">
                <TrendingUp strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-ink-strong">
              <AnimatedNumber value={todaySalesTotal} />
            </div>
            <p className="text-xs text-ink-muted mt-1">
              عدد الفواتير: <span className="font-bold text-ink-strong">{todaySalesInvoices.length}</span>
            </p>
          </CardContent>
        </Card>

        {/* 2. مجمل الربح */}
        <Card className="hover:border-success-border transition-colors">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">مجمل ربح اليوم</span>
              <div className="w-9 h-9 rounded-xl bg-success-bg text-success flex items-center justify-center">
                <DollarSign strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-success">
              <AnimatedNumber value={todayGrossProfit} />
            </div>
            <p className="text-xs text-ink-muted mt-1">
              الهامش:{' '}
              <span className="font-bold text-success">
                {todaySalesTotal > 0 ? formatPercent((todayGrossProfit / todaySalesTotal) * 100) : '0%'}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* 3. مصروفات اليوم */}
        <Card className="hover:border-danger-border transition-colors">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">مصروفات اليوم</span>
              <div className="w-9 h-9 rounded-xl bg-danger-bg text-danger-text flex items-center justify-center">
                <Receipt strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-danger-text">
              <AnimatedNumber value={todayExpensesTotal} />
            </div>
            <p className="text-xs text-ink-muted mt-1">
              عدد البنود: <span className="font-bold text-ink-strong">{todayExpenses.length} مصروفات</span>
            </p>
          </CardContent>
        </Card>

        {/* 4. نقدية الدرج الحالي */}
        <Card className="hover:border-warning-border transition-colors">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">نقدية الدرج (كاش)</span>
              <div className="w-9 h-9 rounded-xl bg-warning-bg text-warning flex items-center justify-center">
                <Vault strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-ink-strong">
              <AnimatedNumber value={currentDrawerCash} />
            </div>
            <p className="text-xs text-ink-muted mt-1 flex items-center gap-1">
              الحالة:{' '}
              {activeDrawer ? (
                <span className="text-success font-bold">مفتوح ومسجل</span>
              ) : (
                <span className="text-warning font-bold">مقفل</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* شريط التنبيهات الذكية */}
      {(lowStockProducts.length > 0 || overCreditCustomers.length > 0 || owedSuppliers.length > 0) && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-ink-strong flex items-center gap-2">
            <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-truffle dark:text-flame" />
            <span>تنبيهات المحل العاجلة</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {lowStockProducts.length > 0 ? (
              <Link href="/products?filter=low-stock">
                <div className="p-3.5 rounded-2xl bg-warning-bg border border-warning-border hover:border-flame transition-colors flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-flame text-abyssal flex items-center justify-center shrink-0">
                    <Boxes strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink-strong">نواقص المخزون</p>
                    <p className="text-xs text-warning truncate mt-0.5">
                      {lowStockProducts.length} أصناف وصلت أو نزلت عن حد الطلب!
                    </p>
                  </div>
                </div>
              </Link>
            ) : null}

            {overCreditCustomers.length > 0 ? (
              <Link href="/customers">
                <div className="p-3.5 rounded-2xl bg-danger-bg border border-danger-border hover:border-truffle transition-colors flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-truffle text-truffle-ink flex items-center justify-center shrink-0">
                    <Users strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink-strong">تجاوز حد الائتمان</p>
                    <p className="text-xs text-danger-text truncate mt-0.5">
                      {overCreditCustomers.length} عميل تجاوزوا سقف الدين المسموح!
                    </p>
                  </div>
                </div>
              </Link>
            ) : null}

            {owedSuppliers.length > 0 ? (
              <Link href="/suppliers">
                <div className="p-3.5 rounded-2xl bg-info-bg border border-info-border hover:border-fantastic transition-colors flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-fantastic text-palladian flex items-center justify-center shrink-0">
                    <Truck strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink-strong">مستحقات الموردين</p>
                    <p className="text-xs text-ink truncate mt-0.5">
                      إجمالي {formatCurrency(totalSuppliersOwed)} لـ {owedSuppliers.length} موردين
                    </p>
                  </div>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {/* بطاقة تفصيلية دائمة لنواقص المخزون */}
      <Card className={lowStockProducts.length > 0 ? 'border-warning-border bg-warning-bg/40' : 'border-success-border bg-success-bg/40'}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Boxes
                strokeWidth={ICON_TOKENS.strokeWidth}
                className={`w-5 h-5 ${lowStockProducts.length > 0 ? 'text-warning' : 'text-success'}`}
              />
              <span>بطاقة تنبيه نواقص المخزون</span>
              <Badge variant={lowStockProducts.length > 0 ? 'warning' : 'success'}>
                {lowStockProducts.length > 0 ? `${lowStockProducts.length} صنف ناقص` : 'المخزون آمن'}
              </Badge>
            </CardTitle>
            <Link href="/products?filter=low-stock" className="text-xs text-truffle dark:text-flame font-bold hover:underline">
              عرض الكل
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {lowStockProducts.length === 0 ? (
            <p className="text-xs text-success font-medium">
              جميع الأصناف المتوفرة تتجاوز حد التنبيه الأدنى حالياً.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {lowStockProducts.slice(0, 6).map((prod) => (
                <Link
                  key={prod.id}
                  href="/products?filter=low-stock"
                  className="p-3 rounded-xl bg-surface border border-warning-border hover:border-flame transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink-strong truncate">{prod.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      حد التنبيه: {prod.minStockAlert} {prod.unit}
                    </p>
                  </div>
                  <Badge variant={prod.currentStock <= 0 ? 'danger' : 'warning'} className="shrink-0 font-mono">
                    متاح: {prod.currentStock}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* شبكة الإجراءات السريعة عريضة اللمس */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-ink-strong">إجراءات سريعة</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Link href="/sales/new">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-surface hover:border-flame hover:bg-flame/15 text-ink-strong rounded-2xl"
            >
              <ShoppingCart strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
              <span className="text-xs font-bold">فاتورة بيع</span>
            </Button>
          </Link>

          <Link href="/products">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-surface hover:border-flame hover:bg-flame/15 text-ink-strong rounded-2xl"
            >
              <Package strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-ink-strong" />
              <span className="text-xs font-bold">إضافة صنف</span>
            </Button>
          </Link>

          <Link href="/expenses">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-surface hover:border-flame hover:bg-flame/15 text-ink-strong rounded-2xl"
            >
              <Receipt strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-danger-text" />
              <span className="text-xs font-bold">صرف مصروف</span>
            </Button>
          </Link>

          <Link href="/inventory">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-surface hover:border-flame hover:bg-flame/15 text-ink-strong rounded-2xl"
            >
              <Boxes strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-success" />
              <span className="text-xs font-bold">جرد المخزن</span>
            </Button>
          </Link>

          <Link href="/drawer" className="col-span-2 sm:col-span-1">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-surface hover:border-flame hover:bg-flame/15 text-ink-strong rounded-2xl"
            >
              <Vault strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-warning" />
              <span className="text-xs font-bold">تقفيل الدرج</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* آخر العمليات اليومية */}
      <Card>
        <CardHeader>
          <CardTitle>آخر العمليات الفورية</CardTitle>
          <Link href="/sales">
            <Button variant="ghost" size="sm" className="text-xs text-truffle dark:text-flame font-bold">
              <span>عرض كل الفواتير</span>
              <ChevronLeft strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 mr-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivities.length === 0 ? (
            <div className="p-8 text-center text-ink-muted text-sm">
              لا توجد عمليات مسجلة اليوم حتى الآن. ابدأ بإنشاء فاتورة بيع جديدة!
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {recentActivities.map((act) => (
                <div key={act.id} className="p-4 flex items-center justify-between hover:bg-surface-alt/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        act.type === 'sale'
                          ? 'bg-success-bg text-success'
                          : 'bg-danger-bg text-danger-text'
                      }`}
                    >
                      {act.type === 'sale' ? (
                        <ArrowDownRight strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink-strong">{act.title}</p>
                      <p className="text-xs text-ink-muted">{act.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p
                      className={`text-sm font-black ${
                        act.type === 'sale' ? 'text-success' : 'text-danger-text'
                      }`}
                    >
                      {act.type === 'sale' ? '+' : '-'}
                      {formatCurrency(act.amount)}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {new Date(act.time).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
