'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  Package,
  Users,
  Truck,
  Printer,
  Sparkles,
  AlertOctagon,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculatePeriodNetProfit } from '@/lib/calculations';
import { formatCurrency, formatPercent, formatArabicDate } from '@/lib/formatters';

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
  } = useShop();

  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // تصفية العمليات حسب الفترة المحددة
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

  // الحسابات المالية الدقيقة
  const totalSalesRevenue = filteredSales.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalCostOfGoodsSold = filteredSales.reduce((sum, inv) => sum + inv.totalCost, 0);
  const totalGrossProfit = filteredSales.reduce((sum, inv) => sum + inv.grossProfit, 0);

  const variableExpenses = filteredExpenses
    .filter((e) => e.type === 'variable')
    .reduce((sum, e) => sum + e.amount, 0);

  // المصروفات الثابتة تخصم مرة واحدة فقط للفترة
  const fixedExpenses = filteredExpenses
    .filter((e) => e.type === 'fixed')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalWithdrawals = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const totalDamagedLoss = filteredDamaged.reduce((sum, d) => sum + d.totalLoss, 0);

  // صافي الربح الفعلي
  const netProfitResult = calculatePeriodNetProfit({
    totalGrossProfit,
    variableExpenses,
    fixedExpenses,
    damagedLoss: totalDamagedLoss,
  });

  // قيمة البضاعة بالمخزن بالتكلفة
  const totalStockCostValue = products.reduce(
    (sum, p) => sum + p.currentStock * (p.costPrice + p.extraCost),
    0
  );

  // إجمالي ديون العملاء
  const totalCustomerDebt = customers.reduce((sum, c) => sum + c.currentBalance, 0);
  // إجمالي مستحقات الموردين
  const totalSupplierOwed = suppliers.reduce((sum, s) => sum + s.owedBalance, 0);

  // الأصناف الأكثر مبيعاً
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

  // مبيعات آخر 7 أيام للرسم البياني
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

  // تصدير التقرير المالي إلى إكسيل XLSX
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. ملخص قائمة الدخل
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

    // 2. تقرير الهالك والتوالف
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

    // 2. تقرير المبيعات
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600" />
            <span>التقارير المالية وصافي الأرباح</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - تقارير دقيقة بالجنيه المصري تفرق تماماً بين النقدية والأرباح
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" />
            <span>طباعة PDF</span>
          </Button>
          <Button variant="primary" size="md" onClick={exportToExcel} className="gap-1.5">
            <Download className="w-4 h-4" />
            <span>تصدير إكسيل (XLSX)</span>
          </Button>
        </div>
      </div>

      {/* شريط اختيار الفترة */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">فترة التقرير:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-3 text-xs border rounded-lg bg-slate-50 font-bold"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              selectedPeriod === 'month'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            شهري ({selectedMonth})
          </button>
          <button
            onClick={() => setSelectedPeriod('year')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              selectedPeriod === 'year'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            سنوي ({selectedMonth.slice(0, 4)})
          </button>
          <button
            onClick={() => setSelectedPeriod('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              selectedPeriod === 'all'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            شامل كل الفترات
          </button>
        </div>
      </div>

      {/* البطاقات المالية الكبرى: صافي الربح وقائمة الدخل */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* صافي الربح */}
        <Card className="bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-lg sm:col-span-2 lg:col-span-1">
          <CardContent className="p-5">
            <span className="text-xs font-bold text-emerald-100 block mb-1">
              صافي الربح الفعلي للفترة
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono">
              {formatCurrency(netProfitResult.netProfit)}
            </div>
            <p className="text-[11px] text-emerald-100 mt-2">
              مجمل الربح - المصروفات - خسائر الهالك
            </p>
          </CardContent>
        </Card>

        {/* إجمالي المبيعات */}
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي المبيعات</span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {formatCurrency(totalSalesRevenue)}
            </div>
            <p className="text-xs text-slate-500 mt-1">عدد الفواتير: {filteredSales.length}</p>
          </CardContent>
        </Card>

        {/* تكلفة البضاعة المباعة */}
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-bold text-slate-500 block mb-1">
              تكلفة البضاعة المباعة (COGS)
            </span>
            <div className="text-2xl font-black text-slate-700 font-mono">
              {formatCurrency(totalCostOfGoodsSold)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              مجمل الربح: <span className="font-bold text-emerald-600">{formatCurrency(totalGrossProfit)}</span>
            </p>
          </CardContent>
        </Card>

        {/* إجمالي المصروفات */}
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي المصروفات</span>
            <div className="text-2xl font-black text-rose-600 font-mono">
              {formatCurrency(netProfitResult.totalExpenses)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ثابتة: {fixedExpenses} | متغيرة: {variableExpenses}
            </p>
          </CardContent>
        </Card>

        {/* خسائر الهالك والتوالف */}
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-bold text-slate-500 block mb-1">خسائر الهالك والتوالف</span>
            <div className="text-2xl font-black text-amber-700 font-mono">
              {formatCurrency(totalDamagedLoss)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              عدد البنود: {filteredDamaged.length} بند
            </p>
          </CardContent>
        </Card>
      </div>

      {/* رسم بياني لمبيعات آخر 7 أيام */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center justify-between w-full">
            <span>مبيعات آخر ٧ أيام (حركة المبيعات اليومية)</span>
            <Badge variant="info">مباشر</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="h-44 flex items-end justify-between gap-2 sm:gap-6 pt-4">
            {last7Days.map((day) => {
              const heightPercent = Math.max(10, Math.min(100, (day.total / maxDailySales) * 100));
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatCurrency(day.total)}
                  </span>
                  <div className="w-full bg-slate-100 rounded-xl h-32 flex items-end overflow-hidden p-1">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-brand-600 hover:bg-brand-500 rounded-lg transition-all"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{day.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* قائمتان متجاورتان: الأصناف الأكثر مبيعاً + أرصدة الأصول والديون */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* الأصناف الأكثر مبيعاً */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              <span>الأصناف الأكثر مبيعاً وطلباً</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topSellingProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا توجد مبيعات مسجلة في هذه الفترة.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topSellingProducts.map((p, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{p.name}</p>
                        <p className="text-[10px] text-slate-400">الكمية المباعة: {p.quantity} قطعة</p>
                      </div>
                    </div>
                    <span className="font-black text-xs font-mono text-brand-700">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* أرصدة الأصول والديون */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>ملخص الأصول والديون والمسحوبات</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
              <span className="text-slate-600 font-medium">قيمة بضاعة المخزن (بسعر التكلفة):</span>
              <span className="font-black font-mono text-slate-900">{formatCurrency(totalStockCostValue)}</span>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 flex items-center justify-between border border-rose-100">
              <span className="text-rose-800 font-medium">ديون العملاء لنا في السوق (آجل):</span>
              <span className="font-black font-mono text-rose-700">{formatCurrency(totalCustomerDebt)}</span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 flex items-center justify-between border border-blue-100">
              <span className="text-blue-800 font-medium">مستحقات الموردين علينا (دين):</span>
              <span className="font-black font-mono text-blue-700">{formatCurrency(totalSupplierOwed)}</span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 flex items-center justify-between border border-amber-100">
              <div>
                <span className="text-amber-900 font-medium block">مسحوبات المالك ({ownerName}):</span>
                <span className="text-[10px] text-amber-700">لا تعتبر مصروفاً ولا تخصم من الأرباح</span>
              </div>
              <span className="font-black font-mono text-amber-800">{formatCurrency(totalWithdrawals)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
