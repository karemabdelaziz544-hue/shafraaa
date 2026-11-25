'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  Package,
  Printer,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton, FormReportSkeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { calculatePeriodNetProfit } from '@/lib/calculations';
import { formatCurrency } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

const Sales7DayChart = dynamic(
  () => import('@/components/reports/sales-7day-chart').then((mod) => mod.Sales7DayChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-56 w-full rounded-2xl" />,
  }
);

export default function ReportsPage() {
  const {
    ownerName,
    products,
    customers,
    suppliers,
    salesInvoices,
    expenses,
    ownerWithdrawals,
    damagedItems,
    isInitialLoading,
  } = useShop();

  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  if (isInitialLoading) {
    return <FormReportSkeleton />;
  }

  const filteredSales = salesInvoices.filter((inv) => {
    if (selectedPeriod === 'all') return true;
    if (selectedPeriod === 'month') return inv.createdAt.startsWith(selectedMonth);
    return inv.createdAt.startsWith(selectedMonth.slice(0, 4));
  });

  const filteredExpenses = expenses.filter((e) => {
    if (selectedPeriod === 'all') return true;
    if (selectedPeriod === 'month') return e.date.startsWith(selectedMonth);
    return e.date.startsWith(selectedMonth.slice(0, 4));
  });

  const filteredWithdrawals = ownerWithdrawals.filter((w) => {
    if (selectedPeriod === 'all') return true;
    if (selectedPeriod === 'month') return w.date.startsWith(selectedMonth);
    return w.date.startsWith(selectedMonth.slice(0, 4));
  });

  const filteredDamaged = damagedItems.filter((d) => {
    if (selectedPeriod === 'all') return true;
    if (selectedPeriod === 'month') return d.date.startsWith(selectedMonth);
    return d.date.startsWith(selectedMonth.slice(0, 4));
  });

  const totalSalesRevenue = filteredSales.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalCostOfGoodsSold = filteredSales.reduce((sum, inv) => sum + inv.totalCost, 0);
  const totalGrossProfit = filteredSales.reduce((sum, inv) => sum + inv.grossProfit, 0);

  const variableExpenses = filteredExpenses
    .filter((e) => e.type === 'variable')
    .reduce((sum, e) => sum + e.amount, 0);

  const fixedExpenses = filteredExpenses
    .filter((e) => e.type === 'fixed')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalWithdrawals = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const totalDamagedLoss = filteredDamaged.reduce((sum, d) => sum + d.totalLoss, 0);

  const netProfitResult = calculatePeriodNetProfit({
    totalGrossProfit,
    variableExpenses,
    fixedExpenses,
    damagedLoss: totalDamagedLoss,
  });

  const totalStockCostValue = products.reduce(
    (sum, p) => sum + p.currentStock * (p.costPrice + p.extraCost),
    0
  );
  const totalCustomerDebt = customers.reduce((sum, c) => sum + c.currentBalance, 0);
  const totalSupplierOwed = suppliers.reduce((sum, s) => sum + s.owedBalance, 0);

  const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  filteredSales.forEach((inv) => {
    inv.items.forEach((item) => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
      }
      productSalesMap[item.productId].quantity += item.quantity;
      productSalesMap[item.productId].revenue += item.lineTotal;
    });
  });

  const topSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const last7Days: { date: string; label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('ar-EG', { weekday: 'short' });
    const dayTotal = salesInvoices
      .filter((inv) => inv.createdAt.startsWith(dateStr))
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    last7Days.push({ date: dateStr, label: dayLabel, total: dayTotal });
  }

  const maxDailySales = Math.max(...last7Days.map((d) => d.total), 100);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const incomeStatementData = [
      { 'البيان': 'إجمالي إيراد المبيعات', 'المبلغ (ج.م)': totalSalesRevenue },
      { 'البيان': 'تكلفة البضاعة المباعة (COGS)', 'المبلغ (ج.م)': totalCostOfGoodsSold },
      { 'البيان': 'مجمل ربح النشاط', 'المبلغ (ج.م)': totalGrossProfit },
      { 'البيان': 'المصروفات المتغيرة', 'المبلغ (ج.م)': variableExpenses },
      { 'البيان': 'المصروفات الثابتة (تخصم مرة للفترة)', 'المبلغ (ج.م)': fixedExpenses },
      { 'البيان': 'خسائر الهالك والتوالف (بسعر التكلفة)', 'المبلغ (ج.م)': totalDamagedLoss },
      { 'البيان': 'صافي الربح الفعلي', 'المبلغ (ج.م)': netProfitResult.netProfit },
      { 'البيان': 'مسحوبات المالك (كريم) - لا تخصم من الأرباح', 'المبلغ (ج.م)': totalWithdrawals },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeStatementData), 'قائمة الدخل والأرباح');

    if (filteredDamaged.length > 0) {
      const damagedExport = filteredDamaged.map((d) => ({
        'اسم الصنف': d.productName,
        'الكمية': d.quantity,
        'تكلفة الوحدة': d.unitCost,
        'إجمالي الخسارة': d.totalLoss,
        'سبب الهلاك': d.reason,
        'التاريخ': d.date,
        'ملاحظات': d.notes || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(damagedExport), 'الهالك والتوالف');
    }

    const salesExport = filteredSales.map((inv) => ({
      'رقم الفاتورة': inv.invoiceNumber,
      'العميل': inv.customerName,
      'طريقة الدفع': inv.paymentMethod,
      'إجمالي الفاتورة': inv.totalAmount,
      'التكلفة': inv.totalCost,
      'مجمل الربح': inv.grossProfit,
      'المدفوع': inv.paidAmount,
      'المتبقي (دين)': inv.remainingAmount,
      'التاريخ': inv.createdAt,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesExport), 'فواتير المبيعات');

    XLSX.writeFile(wb, `تقرير_محل_شفرة_${selectedMonth}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة وأزرار التصدير والطباعة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <BarChart3 strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>التقارير المالية وصافي الأرباح</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا {ownerName} - تقارير دقيقة بالجنيه المصري تفرق تماماً بين النقدية والأرباح
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <Button variant="outline" size="md" onClick={() => window.print()} className="gap-1.5">
            <Printer strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
            <span>طباعة PDF</span>
          </Button>
          <Button variant="primary" size="md" onClick={exportToExcel} className="gap-1.5">
            <Download strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
            <span>تصدير إكسيل (XLSX)</span>
          </Button>
        </div>
      </div>

      {/* شريط اختيار الفترة */}
      <div className="bg-surface p-3.5 rounded-2xl border border-line flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          <Calendar strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted" />
          <span className="text-xs font-bold text-ink">فترة التقرير:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-3 text-xs border border-line rounded-lg bg-surface-alt text-ink-strong font-bold focus:outline-none focus:border-flame"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              selectedPeriod === 'month'
                ? 'bg-flame text-abyssal border-flame'
                : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
            }`}
          >
            شهري ({selectedMonth})
          </button>
          <button
            onClick={() => setSelectedPeriod('year')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              selectedPeriod === 'year'
                ? 'bg-flame text-abyssal border-flame'
                : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
            }`}
          >
            سنوي ({selectedMonth.slice(0, 4)})
          </button>
          <button
            onClick={() => setSelectedPeriod('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              selectedPeriod === 'all'
                ? 'bg-flame text-abyssal border-flame'
                : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
            }`}
          >
            شامل كل الفترات
          </button>
        </div>
      </div>

      {/* البطاقات المالية الكبرى: صافي الربح وقائمة الدخل */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-abyssal to-fantastic text-palladian border-abyssal shadow-elevated sm:col-span-2 lg:col-span-1">
          <CardContent className="p-5">
            <span className="text-xs font-bold text-oatmeal block mb-1">
              صافي الربح الفعلي للفترة
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-flame">
              <AnimatedNumber value={netProfitResult.netProfit} />
            </div>
            <p className="text-[11px] text-oatmeal mt-2">
              مجمل الربح - المصروفات - خسائر الهالك
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-bold text-ink-muted block mb-1">إجمالي المبيعات</span>
            <div className="text-2xl font-black text-ink-strong font-mono">
              <AnimatedNumber value={totalSalesRevenue} />
            </div>
            <p className="text-xs text-ink-muted mt-1">عدد الفواتير: {filteredSales.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-bold text-ink-muted block mb-1">
              تكلفة البضاعة المباعة (COGS)
            </span>
            <div className="text-2xl font-black text-ink font-mono">
              <AnimatedNumber value={totalCostOfGoodsSold} />
            </div>
            <p className="text-xs text-ink-muted mt-1">
              مجمل الربح: <span className="font-bold text-success">{formatCurrency(totalGrossProfit)}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-bold text-ink-muted block mb-1">إجمالي المصروفات</span>
            <div className="text-2xl font-black text-danger-text font-mono">
              <AnimatedNumber value={netProfitResult.totalExpenses} />
            </div>
            <p className="text-xs text-ink-muted mt-1">
              ثابتة: {fixedExpenses} | متغيرة: {variableExpenses}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-bold text-ink-muted block mb-1">خسائر الهالك والتوالف</span>
            <div className="text-2xl font-black text-warning font-mono">
              <AnimatedNumber value={totalDamagedLoss} />
            </div>
            <p className="text-xs text-ink-muted mt-1">
              عدد البنود: {filteredDamaged.length} بند
            </p>
          </CardContent>
        </Card>
      </div>

      {/* رسم بياني محمّل كسولاً لمبيعات آخر 7 أيام */}
      <Sales7DayChart days={last7Days} maxDailySales={maxDailySales} />

      {/* قائمتان متجاورتان */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Package strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-truffle dark:text-flame" />
              <span>الأصناف الأكثر مبيعاً وطلباً</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topSellingProducts.length === 0 ? (
              <div className="p-8 text-center text-ink-muted text-xs">
                لا توجد مبيعات مسجلة في هذه الفترة.
              </div>
            ) : (
              <div className="divide-y divide-divider">
                {topSellingProducts.map((p, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-flame/25 text-ink-strong font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-ink-strong">{p.name}</p>
                        <p className="text-[10px] text-ink-muted">الكمية المباعة: {p.quantity} قطعة</p>
                      </div>
                    </div>
                    <span className="font-black text-xs font-mono text-truffle dark:text-flame">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <DollarSign strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-success" />
              <span>ملخص الأصول والديون والمسحوبات</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-surface-alt border border-line flex items-center justify-between">
              <span className="text-ink font-medium">قيمة بضاعة المخزن (بسعر التكلفة):</span>
              <span className="font-black font-mono text-ink-strong">{formatCurrency(totalStockCostValue)}</span>
            </div>

            <div className="p-3 rounded-xl bg-danger-bg flex items-center justify-between border border-danger-border">
              <span className="text-danger-text font-medium">ديون العملاء لنا في السوق (آجل):</span>
              <span className="font-black font-mono text-danger-text">{formatCurrency(totalCustomerDebt)}</span>
            </div>

            <div className="p-3 rounded-xl bg-info-bg flex items-center justify-between border border-info-border">
              <span className="text-ink-strong font-medium">مستحقات الموردين علينا (دين):</span>
              <span className="font-black font-mono text-ink-strong">{formatCurrency(totalSupplierOwed)}</span>
            </div>

            <div className="p-3 rounded-xl bg-warning-bg flex items-center justify-between border border-warning-border">
              <div>
                <span className="text-ink-strong font-medium block">مسحوبات المالك ({ownerName}):</span>
                <span className="text-[10px] text-warning">لا تعتبر مصروفاً ولا تخصم من الأرباح</span>
              </div>
              <span className="font-black font-mono text-warning">{formatCurrency(totalWithdrawals)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
