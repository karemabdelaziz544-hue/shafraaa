'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Layers,
  Sparkles,
  Info,
  AlertOctagon,
} from 'lucide-react';
import { useShop, Product } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';

export default function InventoryPage() {
  const {
    products,
    physicalCounts,
    savePhysicalCountDraft,
    approvePhysicalCount,
  } = useShop();

  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [countItems, setCountItems] = useState<Record<string, number>>({});
  const [countNotes, setCountNotes] = useState('');
  const [selectedCountId, setSelectedCountId] = useState<string | null>(null);

  // حساب قيمة بضاعة المحل الإجمالية بسعر التكلفة
  const totalStockCostValue = products.reduce(
    (sum, p) => sum + p.currentStock * (p.costPrice + p.extraCost),
    0
  );

  // إجمالي عدد القطع في المحل
  const totalItemsCount = products.reduce((sum, p) => sum + p.currentStock, 0);

  // فتح نموذج جرد فعلي جديد
  const handleOpenNewCount = () => {
    const initialCounts: Record<string, number> = {};
    products.forEach((p) => {
      initialCounts[p.id] = p.currentStock; // تبدأ برصيد النظام
    });
    setCountItems(initialCounts);
    setCountNotes('');
    setIsCountModalOpen(true);
  };

  // حفظ مسودة الجرد
  const handleSaveDraft = async () => {
    const items = Object.entries(countItems).map(([productId, countedStock]) => ({
      productId,
      countedStock,
    }));
    const res = await savePhysicalCountDraft(items, countNotes);
    if (!res.ok) {
      alert(res.error || 'تعذر حفظ مسودة الجرد');
      return;
    }
    setIsCountModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-brand-600" />
            <span>المخزون والجرد الفعلي وقيمة البضاعة</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - معادلة المخزون الصارمة: رصيد أول + مشتريات - مبيعات + مرتجع سليم - توالف
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenNewCount}>
          <ClipboardCheck className="w-4 h-4 ml-1" />
          <span>بدء جرد فعلي جديد</span>
        </Button>
      </div>

      {/* التبديل بين شاشات قسم المخزون */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Link
          href="/inventory"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 text-white shadow-md shadow-brand-500/20 transition-all"
        >
          <Boxes className="w-4 h-4" />
          <span>المخزون والجرد وقيمة البضاعة</span>
        </Link>

        <Link
          href="/inventory/damaged"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all"
        >
          <AlertOctagon className="w-4 h-4 text-rose-600" />
          <span>سجل الهالك والتوالف (الخسائر)</span>
        </Link>
      </div>

      {/* بطاقات الإحصاءات المخزنية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* قيمة البضاعة بسعر التكلفة */}
        <Card className="bg-gradient-to-br from-blue-900 to-brand-800 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-200">إجمالي قيمة البضاعة (بالتكلفة)</span>
              <DollarSign className="w-5 h-5 text-blue-300" />
            </div>
            <div className="text-2xl sm:text-3xl font-black">
              {formatCurrency(totalStockCostValue)}
            </div>
            <p className="text-xs text-blue-200 mt-1">
              رأس مالك المربوط في البضاعة حاليًا
            </p>
          </CardContent>
        </Card>

        {/* إجمالي عدد القطع */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">إجمالي عدد القطع بالمخزن</span>
              <Layers className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {totalItemsCount} قطعة
            </div>
            <p className="text-xs text-slate-500 mt-1">
              موزعة على {products.length} صنف مسجل
            </p>
          </CardContent>
        </Card>

        {/* الأصناف الناقصة */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">الأصناف الحرجة (نواقص)</span>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">
              {products.filter((p) => p.currentStock <= p.minStockAlert).length} أصناف
            </div>
            <p className="text-xs text-slate-500 mt-1">
              تحتاج إلى إصدار فواتير توريد فوري
            </p>
          </CardContent>
        </Card>
      </div>

      {/* تفاصيل مخزون الأصناف الحالية */}
      <Card>
        <CardHeader>
          <CardTitle>أرصدة المخزون وقيمتها بالتكلفة</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 sm:p-4">الصنف والباركود</th>
                <th className="p-3 sm:p-4">القسم</th>
                <th className="p-3 sm:p-4">رصيد أول المدة</th>
                <th className="p-3 sm:p-4">الرصيد الحالي</th>
                <th className="p-3 sm:p-4">سعر التكلفة</th>
                <th className="p-3 sm:p-4">قيمة الرصيد بالتكلفة</th>
                <th className="p-3 sm:p-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const totalCost = p.costPrice + p.extraCost;
                const valueAtCost = p.currentStock * totalCost;
                const isLow = p.currentStock <= p.minStockAlert;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sm:p-4">
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{p.barcode || 'بدون باركود'}</p>
                    </td>
                    <td className="p-3 sm:p-4">
                      <Badge variant="default">{p.category}</Badge>
                    </td>
                    <td className="p-3 sm:p-4 font-mono">{p.openingStock}</td>
                    <td className="p-3 sm:p-4 font-mono font-black text-slate-900">
                      {p.currentStock} {p.unit}
                    </td>
                    <td className="p-3 sm:p-4 font-mono">{formatCurrency(totalCost)}</td>
                    <td className="p-3 sm:p-4 font-mono font-bold text-brand-700">
                      {formatCurrency(valueAtCost)}
                    </td>
                    <td className="p-3 sm:p-4">
                      {isLow ? (
                        <Badge variant="danger">أقل من حد الطلب ({p.minStockAlert})</Badge>
                      ) : (
                        <Badge variant="success">متوفر</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* سجل جلسات الجرد الفعلي والاعتماد */}
      <Card>
        <CardHeader>
          <CardTitle>سجل جلسات الجرد الفعلي وتطبيق التسويات</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {physicalCounts.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              لم يتم إجراء أي جلسات جرد فعلي حتى الآن. اضغط &quot;بدء جرد فعلي جديد&quot; للمقارنة بين رصيد النظام والعدد الواقعي بالمحل.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {physicalCounts.map((count) => (
                <div key={count.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">
                        جلسة جرد رقم #{count.countNumber}
                      </h4>
                      <Badge variant={count.status === 'approved' ? 'success' : 'warning'}>
                        {count.status === 'approved' ? 'معتمد رسميًا' : 'مسودة قيد المراجعة'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      التاريخ: {count.countDate} | عدد الأصناف المجرودة: {count.items.length} صنف
                    </p>
                    {count.notes && <p className="text-xs text-slate-400 mt-0.5">{count.notes}</p>}
                    {count.approvedAt && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                        اعتمدها: {count.approvedBy} في {new Date(count.approvedAt).toLocaleDateString('ar-EG')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 block">تكلفة فارق الجرد:</span>
                      <span
                        className={`font-black text-sm ${
                          count.totalVarianceCost < 0
                            ? 'text-rose-600'
                            : count.totalVarianceCost > 0
                            ? 'text-emerald-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {formatCurrency(count.totalVarianceCost)}
                      </span>
                    </div>

                    {count.status === 'draft' && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              'هل أنت متأكد من اعتماد نتائج هذا الجرد وتحديث أرصدة المخزن الحقيقية الآن؟'
                            )
                          ) {
                            approvePhysicalCount(count.id);
                          }
                        }}
                        className="font-bold gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>اعتماد وتحديث المخزن</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة الجرد الفعلي */}
      {isCountModalOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setIsCountModalOpen(false)}
          title="تسجيل جلسة جرد فعلي للمحل"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                أهلًا يا كريم: أدخل العدد الفعلي الموجود على الأرفف لكل صنف. سيظهر لك الفارق (عجز أو زيادة) فورًا، ولن يتم تعديل أرصدة المخزن إلا بعد أن تضغط &quot;اعتماد وتحديث المخزن&quot; رسميًا!
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 divide-y divide-slate-100">
              {products.map((p) => {
                const counted = countItems[p.id] ?? p.currentStock;
                const variance = counted - p.currentStock;
                const cost = p.costPrice + p.extraCost;
                const varCost = variance * cost;

                return (
                  <div key={p.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500">رصيد النظام: {p.currentStock} {p.unit}</p>
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        value={counted}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCountItems((prev) => ({ ...prev, [p.id]: val }));
                        }}
                        className="w-full h-9 px-2 text-center text-xs font-bold border rounded-lg"
                      />
                    </div>

                    <div className="text-left w-24">
                      <span
                        className={`font-black ${
                          variance < 0
                            ? 'text-rose-600'
                            : variance > 0
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {variance > 0 ? `+${variance}` : variance} {p.unit}
                      </span>
                      <p className="text-[10px] text-slate-400 font-mono">{formatCurrency(varCost)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات الجرد</label>
              <input
                type="text"
                value={countNotes}
                onChange={(e) => setCountNotes(e.target.value)}
                placeholder="مثال: جرد نصف شهري لبضاعة الإكسسوار والشواحن"
                className="w-full h-10 px-3 text-xs border rounded-xl"
              />
            </div>

            <div className="pt-2 border-t flex justify-end gap-2">
              <Button variant="outline" size="md" onClick={() => setIsCountModalOpen(false)}>
                إلغاء
              </Button>
              <Button variant="primary" size="md" onClick={handleSaveDraft}>
                حفظ مسودة الجرد للمراجعة
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
