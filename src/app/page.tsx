'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Vault,
  Plus,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Boxes,
  Lock,
  ChevronLeft,
  Users,
  Truck,
  Sparkles,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatArabicDate, formatPercent } from '@/lib/formatters';

export default function HomePage() {
  const {
    ownerName,
    products,
    customers,
    suppliers,
    salesInvoices,
    expenses,
    activeDrawer,
  } = useShop();

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
  // أ. منتجات وصلت أو نزلت عن حد الطلب
  const lowStockProducts = products.filter((p) => p.currentStock <= p.minStockAlert);
  // ب. عملاء تجاوزوا حد الائتمان
  const overCreditCustomers = customers.filter(
    (c) => c.creditLimit > 0 && c.currentBalance > c.creditLimit
  );
  // ج. موردين مستحق لهم مبالغ
  const owedSuppliers = suppliers.filter((s) => s.owedBalance > 0);
  const totalSuppliersOwed = owedSuppliers.reduce((sum, s) => sum + s.owedBalance, 0);

  // آخر العمليات (فواتير، مصروفات)
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
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* بطاقة الترحيب العريضة الخاصة بالمالك كريم */}
      <div className="bg-gradient-to-l from-brand-900 via-brand-800 to-brand-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-brand-950/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-brand-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>لوحة التحكم الكاملة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              أهلًا يا {ownerName}، يوم موفق في تجارتك!
            </h1>
            <p className="text-sm sm:text-base text-brand-100/90 max-w-xl">
              كل عمليات محلك تحت سيطرتك المباشرة: مبيعات، تكلفة حقيقية، مخزون دقيق، وتقفيل الدرج بالجنيه المصري.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/sales/new">
              <Button size="xl" className="bg-white text-brand-900 hover:bg-slate-100 shadow-lg font-bold">
                <ShoppingCart className="w-5 h-5 text-brand-600" />
                <span>فاتورة بيع سريعة</span>
              </Button>
            </Link>
            <Link href="/drawer">
              <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10 font-semibold">
                <Vault className="w-5 h-5" />
                <span>{activeDrawer ? 'إدارة الدرج' : 'فتح الوردية'}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* المؤشرات المالية الرئيسية الأربعة (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* 1. مبيعات اليوم */}
        <Card className="hover:border-brand-300 transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">مبيعات اليوم</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900">
              {formatCurrency(todaySalesTotal)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              عدد الفواتير: <span className="font-bold text-slate-800">{todaySalesInvoices.length}</span>
            </p>
          </CardContent>
        </Card>

        {/* 2. مجمل الربح */}
        <Card className="hover:border-emerald-300 transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">مجمل ربح اليوم</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-emerald-600">
              {formatCurrency(todayGrossProfit)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              الهامش:{' '}
              <span className="font-bold text-emerald-700">
                {todaySalesTotal > 0 ? formatPercent((todayGrossProfit / todaySalesTotal) * 100) : '0%'}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* 3. مصروفات اليوم */}
        <Card className="hover:border-rose-300 transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">مصروفات اليوم</span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-rose-600">
              {formatCurrency(todayExpensesTotal)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              عدد البنود: <span className="font-bold text-slate-700">{todayExpenses.length} مصروفات</span>
            </p>
          </CardContent>
        </Card>

        {/* 4. نقدية الدرج الحالي */}
        <Card className="hover:border-amber-300 transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">نقدية الدرج (كاش)</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Vault className="w-5 h-5" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900">
              {formatCurrency(currentDrawerCash)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              الحالة:{' '}
              {activeDrawer ? (
                <span className="text-emerald-600 font-bold">مفتوح ومسجل</span>
              ) : (
                <span className="text-amber-600 font-bold">مقفل</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* شريط التنبيهات الذكية (النواقص، ديون العملاء، مستحقات الموردين) */}
      {(lowStockProducts.length > 0 || overCreditCustomers.length > 0 || owedSuppliers.length > 0) && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>تنبيهات المحل العاجلة</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* تنبيه نواقص المخزون */}
            {lowStockProducts.length > 0 ? (
              <Link href="/products?filter=low-stock">
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 hover:bg-amber-100/80 transition-all flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-900">نواقص المخزون</p>
                    <p className="text-xs text-amber-700 truncate mt-0.5">
                      {lowStockProducts.length} أصناف وصلت أو نزلت عن حد الطلب!
                    </p>
                  </div>
                </div>
              </Link>
            ) : null}

            {/* تنبيه تجاوز حد الائتمان */}
            {overCreditCustomers.length > 0 ? (
              <Link href="/customers">
                <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 hover:bg-rose-100/80 transition-all flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-rose-900">تجاوز حد الائتمان</p>
                    <p className="text-xs text-rose-700 truncate mt-0.5">
                      {overCreditCustomers.length} عميل تجاوزوا سقف الدين المسموح!
                    </p>
                  </div>
                </div>
              </Link>
            ) : null}

            {/* تنبيه مستحقات الموردين */}
            {owedSuppliers.length > 0 ? (
              <Link href="/suppliers">
                <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 hover:bg-blue-100/80 transition-all flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-900">مستحقات الموردين</p>
                    <p className="text-xs text-blue-700 truncate mt-0.5">
                      إجمالي {formatCurrency(totalSuppliersOwed)} لـ {owedSuppliers.length} موردين
                    </p>
                  </div>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {/* شبكة الإجراءات السريعة عريضة اللمس */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">إجراءات سريعة</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Link href="/sales/new">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-white hover:border-brand-500 hover:text-brand-600 text-slate-800 rounded-2xl"
            >
              <ShoppingCart className="w-6 h-6 text-brand-600" />
              <span className="text-xs font-bold">فاتورة بيع</span>
            </Button>
          </Link>

          <Link href="/products">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-white hover:border-brand-500 hover:text-brand-600 text-slate-800 rounded-2xl"
            >
              <Package className="w-6 h-6 text-blue-600" />
              <span className="text-xs font-bold">إضافة صنف</span>
            </Button>
          </Link>

          <Link href="/expenses">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-white hover:border-brand-500 hover:text-brand-600 text-slate-800 rounded-2xl"
            >
              <Receipt className="w-6 h-6 text-rose-600" />
              <span className="text-xs font-bold">صرف مصروف</span>
            </Button>
          </Link>

          <Link href="/inventory">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-white hover:border-brand-500 hover:text-brand-600 text-slate-800 rounded-2xl"
            >
              <Boxes className="w-6 h-6 text-emerald-600" />
              <span className="text-xs font-bold">جرد المخزن</span>
            </Button>
          </Link>

          <Link href="/drawer">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 flex-col gap-2 bg-white hover:border-brand-500 hover:text-brand-600 text-slate-800 rounded-2xl col-span-2 sm:col-span-1"
            >
              <Vault className="w-6 h-6 text-amber-600" />
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
            <Button variant="ghost" size="sm" className="text-xs text-brand-600">
              <span>عرض كل الفواتير</span>
              <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivities.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              لا توجد عمليات مسجلة اليوم حتى الآن. ابدأ بإنشاء فاتورة بيع جديدة!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <div key={act.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        act.type === 'sale'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {act.type === 'sale' ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{act.title}</p>
                      <p className="text-xs text-slate-500">{act.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p
                      className={`text-sm font-black ${
                        act.type === 'sale' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {act.type === 'sale' ? '+' : '-'}
                      {formatCurrency(act.amount)}
                    </p>
                    <p className="text-[11px] text-slate-400">
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
