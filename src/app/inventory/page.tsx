'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Layers,
  Info,
  AlertOctagon,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function InventoryPage() {
  const {
    products,
    physicalCounts,
    savePhysicalCountDraft,
    approvePhysicalCount,
    can,
    isInitialLoading,
  } = useShop();
  const canViewCost = can('finance.view_cost_profit');

  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [countItems, setCountItems] = useState<Record<string, number>>({});
  const [countNotes, setCountNotes] = useState('');

  const totalStockCostValue = products.reduce(
    (sum, p) => sum + p.currentStock * (p.costPrice + p.extraCost),
    0
  );

  const totalItemsCount = products.reduce((sum, p) => sum + p.currentStock, 0);

  const handleOpenNewCount = () => {
    const initialCounts: Record<string, number> = {};
    products.forEach((p) => {
      initialCounts[p.id] = p.currentStock;
    });
    setCountItems(initialCounts);
    setCountNotes('');
    setIsCountModalOpen(true);
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <Boxes strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>المخزون والجرد الفعلي وقيمة البضاعة</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا كريم - معادلة المخزون الصارمة: رصيد أول + مشتريات - مبيعات + مرتجع سليم - توالف
          </p>
        </div>

        {can('inventory.manage') && (
          <Button variant="primary" size="md" onClick={handleOpenNewCount}>
            <ClipboardCheck strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1" />
            <span>بدء جرد فعلي جديد</span>
          </Button>
        )}
      </div>

      {/* التبديل بين شاشات قسم المخزون */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <Link
          href="/inventory"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-flame text-abyssal shadow-sm transition-colors"
        >
          <Boxes strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
          <span>المخزون والجرد وقيمة البضاعة</span>
        </Link>

        <Link
          href="/inventory/damaged"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-surface text-ink hover:bg-surface-alt border border-line transition-colors"
        >
          <AlertOctagon strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-truffle dark:text-flame" />
          <span>سجل الهالك والتوالف (الخسائر)</span>
        </Link>
      </div>

      {/* بطاقات الإحصاءات المخزنية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {canViewCost && (
          <Card className="bg-gradient-to-br from-abyssal to-fantastic text-palladian border-abyssal">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-oatmeal">إجمالي قيمة البضاعة (بالتكلفة)</span>
                <DollarSign strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-flame" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-flame">
                {formatCurrency(totalStockCostValue)}
              </div>
              <p className="text-xs text-oatmeal mt-1">
                رأس مالك المربوط في البضاعة حاليًا
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">إجمالي عدد القطع بالمخزن</span>
              <Layers strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-ink-muted" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-ink-strong">
              {totalItemsCount} قطعة
            </div>
            <p className="text-xs text-ink-muted mt-1">
              موزعة على {products.length} صنف مسجل
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">الأصناف الحرجة (نواقص)</span>
              <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-warning" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-warning">
              {products.filter((p) => p.currentStock <= p.minStockAlert).length} أصناف
            </div>
            <p className="text-xs text-ink-muted mt-1">
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
          {isInitialLoading ? (
            <TableSkeletonRows columns={6} rows={5} />
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                <tr>
                  <th className="p-3 sm:p-4">الصنف والباركود</th>
                  <th className="p-3 sm:p-4">القسم</th>
                  <th className="p-3 sm:p-4">رصيد أول المدة</th>
                  <th className="p-3 sm:p-4">الرصيد الحالي</th>
                  {canViewCost && <th className="p-3 sm:p-4">سعر التكلفة</th>}
                  {canViewCost && <th className="p-3 sm:p-4">قيمة الرصيد بالتكلفة</th>}
                  <th className="p-3 sm:p-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {products.map((p) => {
                  const totalCost = p.costPrice + p.extraCost;
                  const valueAtCost = p.currentStock * totalCost;
                  const isLow = p.currentStock <= p.minStockAlert;

                  return (
                    <tr key={p.id} className="hover:bg-surface-alt/60 transition-colors">
                      <td className="p-3 sm:p-4">
                        <p className="font-bold text-ink-strong">{p.name}</p>
                        <p className="text-[10px] font-mono text-ink-muted">{p.barcode || 'بدون باركود'}</p>
                      </td>
                      <td className="p-3 sm:p-4">
                        <Badge variant="default">{p.category}</Badge>
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-ink">{p.openingStock}</td>
                      <td className="p-3 sm:p-4 font-mono font-black text-ink-strong">
                        {p.currentStock} {p.unit}
                      </td>
                      {canViewCost && (
                        <td className="p-3 sm:p-4 font-mono text-ink">{formatCurrency(totalCost)}</td>
                      )}
                      {canViewCost && (
                        <td className="p-3 sm:p-4 font-mono font-bold text-danger-text dark:text-flame">
                          {formatCurrency(valueAtCost)}
                        </td>
                      )}
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
          )}
        </CardContent>
      </Card>

      {/* سجل جلسات الجرد الفعلي والاعتماد */}
      <Card>
        <CardHeader>
          <CardTitle>سجل جلسات الجرد الفعلي وتطبيق التسويات</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {physicalCounts.length === 0 ? (
            <div className="p-10 text-center text-ink-muted text-xs">
              لم يتم إجراء أي جلسات جرد فعلي حتى الآن. اضغط &quot;بدء جرد فعلي جديد&quot; للمقارنة بين رصيد النظام والعدد الواقعي بالمحل.
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {physicalCounts.map((count) => (
                <div key={count.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-ink-strong text-sm">
                        جلسة جرد رقم #{count.countNumber}
                      </h4>
                      <Badge variant={count.status === 'approved' ? 'success' : 'warning'}>
                        {count.status === 'approved' ? 'معتمد رسميًا' : 'مسودة قيد المراجعة'}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-muted mt-1">
                      التاريخ: {count.countDate} | عدد الأصناف المجرودة: {count.items.length} صنف
                    </p>
                    {count.notes && <p className="text-xs text-ink-muted mt-0.5">{count.notes}</p>}
                    {count.approvedAt && (
                      <p className="text-[11px] text-success font-semibold mt-1">
                        اعتمدها: {count.approvedBy} في {new Date(count.approvedAt).toLocaleDateString('ar-EG')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {canViewCost && (
                      <div className="text-left">
                        <span className="text-[11px] text-ink-muted block">تكلفة فارق الجرد:</span>
                        <span
                          className={`font-black text-sm ${
                            count.totalVarianceCost < 0
                              ? 'text-danger-text'
                              : count.totalVarianceCost > 0
                              ? 'text-success'
                              : 'text-ink-strong'
                          }`}
                        >
                          {formatCurrency(count.totalVarianceCost)}
                        </span>
                      </div>
                    )}

                    {count.status === 'draft' && can('inventory.manage') && (
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
                        <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
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
            <div className="p-3 bg-warning-bg border border-warning-border rounded-xl text-xs text-warning flex items-start gap-2">
              <Info strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 shrink-0 text-warning mt-0.5" />
              <span>
                أهلًا يا كريم: أدخل العدد الفعلي الموجود على الأرفف لكل صنف. سيظهر لك الفارق (عجز أو زيادة) فورًا، ولن يتم تعديل أرصدة المخزن إلا بعد أن تضغط &quot;اعتماد وتحديث المخزن&quot; رسميًا!
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 divide-y divide-divider">
              {products.map((p) => {
                const counted = countItems[p.id] ?? p.currentStock;
                const variance = counted - p.currentStock;
                const cost = p.costPrice + p.extraCost;
                const varCost = variance * cost;

                return (
                  <div key={p.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ink-strong truncate">{p.name}</p>
                      <p className="text-[11px] text-ink-muted">رصيد النظام: {p.currentStock} {p.unit}</p>
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
                        className="w-full h-9 px-2 text-center text-xs font-bold border border-line bg-surface text-ink-strong rounded-lg focus:outline-none focus:border-flame"
                      />
                    </div>

                    <div className="text-left w-24">
                      <span
                        className={`font-black ${
                          variance < 0
                            ? 'text-danger-text'
                            : variance > 0
                            ? 'text-success'
                            : 'text-ink-muted'
                        }`}
                      >
                        {variance > 0 ? `+${variance}` : variance} {p.unit}
                      </span>
                      <p className="text-[10px] text-ink-muted font-mono">{formatCurrency(varCost)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">ملاحظات الجرد</label>
              <input
                type="text"
                value={countNotes}
                onChange={(e) => setCountNotes(e.target.value)}
                placeholder="مثال: جرد نصف شهري لبضاعة الإكسسوار والشواحن"
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
              />
            </div>

            <div className="pt-2 border-t border-divider flex justify-end gap-2">
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
