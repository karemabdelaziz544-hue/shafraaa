'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  Plus,
  Search,
  Boxes,
  Calendar,
  DollarSign,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function DamagedInventoryPage() {
  const { products, damagedItems, addDamagedItem, can, isInitialLoading } = useShop();
  const canViewCost = can('finance.view_cost_profit');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<{
    selectionMode: 'product' | 'custom';
    productId: string;
    customName: string;
    quantity: number;
    unitCost: number;
    reason: string;
    date: string;
    notes: string;
  }>({
    selectionMode: 'product',
    productId: '',
    customName: '',
    quantity: 1,
    unitCost: 0,
    reason: 'كسر أثناء النسخ أو التجربة',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const filteredDamaged = damagedItems.filter((item) => {
    const itemMonth = item.date.slice(0, 7);
    const matchesMonth = selectedMonth === 'all' || itemMonth === selectedMonth;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.productName.toLowerCase().includes(q) ||
      item.reason.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q));

    return matchesMonth && matchesSearch;
  });

  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const thisMonthLosses = damagedItems
    .filter((d) => d.date.startsWith(currentMonthStr))
    .reduce((sum, d) => sum + d.totalLoss, 0);

  const thisMonthPieces = damagedItems
    .filter((d) => d.date.startsWith(currentMonthStr))
    .reduce((sum, d) => sum + d.quantity, 0);

  const allTimeLosses = damagedItems.reduce((sum, d) => sum + d.totalLoss, 0);

  const handleOpenAdd = () => {
    setFormData({
      selectionMode: 'product',
      productId: products[0]?.id || '',
      customName: '',
      quantity: 1,
      unitCost: products[0] ? products[0].costPrice + products[0].extraCost : 0,
      reason: 'كسر أثناء النسخ أو التجربة',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveDamaged = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.selectionMode === 'product' && !formData.productId) {
      alert('يرجى اختيار الصنف من المخزن');
      return;
    }
    if (formData.selectionMode === 'custom' && !formData.customName.trim()) {
      alert('يرجى كتابة وصف أو اسم الصنف الهالك');
      return;
    }
    if (formData.quantity <= 0) {
      alert('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    const res = await addDamagedItem({
      productId: formData.selectionMode === 'product' ? formData.productId : null,
      productName:
        formData.selectionMode === 'product'
          ? products.find((p) => p.id === formData.productId)?.name
          : formData.customName,
      quantity: formData.quantity,
      unitCost: formData.unitCost,
      reason: formData.reason,
      date: formData.date,
      notes: formData.notes,
    });

    if (!res.ok) {
      alert(res.error || 'تعذر تسجيل الهالك في قاعدة البيانات');
      return;
    }

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <AlertOctagon strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>سجل الهالك والتوالف وفاقد المخزون</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا كريم - تسجيل التوالف يخفض المخزون ويحسب خسارة بالتكلفة لضبط الأرباح الصافية
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can('inventory.manage') && (
            <Button variant="danger" size="md" onClick={handleOpenAdd} className="gap-1.5 font-bold">
              <Plus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
              <span>تسجيل صنف هالك / تالف</span>
            </Button>
          )}
        </div>
      </div>

      {/* التبديل بين شاشات قسم المخزون */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <Link
          href="/inventory"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-surface text-ink hover:bg-surface-alt border border-line transition-colors"
        >
          <Boxes strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
          <span>المخزون والجرد وقيمة البضاعة</span>
        </Link>

        <Link
          href="/inventory/damaged"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-truffle text-truffle-ink shadow-sm transition-colors"
        >
          <AlertOctagon strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
          <span>الهالك والتوالف والخسائر ({damagedItems.length})</span>
        </Link>
      </div>

      {/* بطاقات الإحصاءات الشهرية والتراكمية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {canViewCost && (
          <Card className="bg-truffle text-truffle-ink border-truffle shadow-elevated">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-truffle-ink">خسائر الهالك هذا الشهر (بالتكلفة)</span>
                <TrendingDown strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-flame" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-truffle-ink">
                {formatCurrency(thisMonthLosses)}
              </div>
              <p className="text-xs text-truffle-ink mt-1">
                تخصم مباشرة من أرباح الفترة بقائمة الدخل
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-danger-border bg-danger-bg/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-ink-strong">القطع الهالكة هذا الشهر</span>
              <AlertOctagon strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-danger-text" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-danger-text font-mono">
              {thisMonthPieces} <span className="text-sm font-normal text-ink">قطعة</span>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              تم خفضها من رصيد المخزن الفعلي
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-ink-muted">إجمالي خسائر الهالك التراكمية</span>
              <DollarSign strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-ink-muted" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-ink-strong font-mono">
              {formatCurrency(allTimeLosses)}
            </div>
            <p className="text-xs text-ink-muted mt-1">
              إجمالي {damagedItems.length} عملية إهلاك مسجلة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* شريط البحث وتصفية الشهور */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-ink-muted absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="ابحث باسم الصنف أو سبب الهلاك أو الملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pr-11 pl-4 rounded-xl border border-line bg-surface text-ink-strong placeholder:text-ink-muted text-sm focus:border-flame focus:outline-none focus:ring-2 focus:ring-flame/25"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted" />
          <input
            type="month"
            value={selectedMonth === 'all' ? '' : selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value || 'all')}
            className="h-11 px-3 text-xs sm:text-sm border border-line rounded-xl bg-surface text-ink-strong font-bold focus:outline-none focus:border-flame"
          />
          {selectedMonth !== 'all' && (
            <button
              onClick={() => setSelectedMonth('all')}
              className="text-xs text-danger-text dark:text-flame hover:underline font-bold px-1"
            >
              عرض الكل
            </button>
          )}
        </div>
      </div>

      {/* جدول سجل الهالك والتوالف */}
      <Card>
        <CardHeader className="py-3 bg-surface-alt border-b border-line flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <span>سجل الأصناف الهالكة والتالفة ({filteredDamaged.length})</span>
          </CardTitle>
          <span className="text-xs text-ink-muted flex items-center gap-1 font-medium">
            <ShieldCheck strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-success" />
            <span>سجل محاسبي دائم وموثق بسجل التدقيق (لا يحذف)</span>
          </span>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isInitialLoading ? (
            <TableSkeletonRows columns={6} rows={4} />
          ) : filteredDamaged.length === 0 ? (
            <div className="p-12 text-center text-ink-muted text-sm">
              لا توجد أصناف هالكة مسجلة في هذه الفترة.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                <tr>
                  <th className="p-3 sm:p-4">التاريخ</th>
                  <th className="p-3 sm:p-4">الصنف / الوصف</th>
                  <th className="p-3 sm:p-4 text-center">الكمية التالفة</th>
                  <th className="p-3 sm:p-4 text-center">تكلفة الوحدة</th>
                  <th className="p-3 sm:p-4 text-center">إجمالي الخسارة</th>
                  <th className="p-3 sm:p-4">سبب الهلاك</th>
                  <th className="p-3 sm:p-4">ملاحظات</th>
                  <th className="p-3 sm:p-4 text-center">الحالة المحاسبية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filteredDamaged.map((item) => (
                  <tr key={item.id} className="hover:bg-danger-bg/30 transition-colors">
                    <td className="p-3 sm:p-4 font-mono text-ink-muted text-xs">
                      {item.date}
                    </td>
                    <td className="p-3 sm:p-4">
                      <p className="font-bold text-ink-strong">{item.productName}</p>
                      {item.productId && (
                        <span className="text-[10px] text-ink-muted block mt-0.5">
                          خصم من رصيد الصنف بالمخزن
                        </span>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 text-center font-bold font-mono text-ink-strong">
                      {item.quantity}
                    </td>
                    <td className="p-3 sm:p-4 text-center font-mono font-medium text-ink">
                      {formatCurrency(item.unitCost)}
                    </td>
                    <td className="p-3 sm:p-4 text-center font-mono font-black text-danger-text">
                      -{formatCurrency(item.totalLoss)}
                    </td>
                    <td className="p-3 sm:p-4">
                      <Badge variant="danger" className="text-[11px]">
                        {item.reason}
                      </Badge>
                    </td>
                    <td className="p-3 sm:p-4 text-ink-muted text-xs max-w-xs truncate">
                      {item.notes || '-'}
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <Badge variant="success" className="gap-1 text-[11px]">
                        <ShieldCheck strokeWidth={ICON_TOKENS.strokeWidth} className="w-3 h-3" />
                        <span>محسوب كخسارة</span>
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* نافذة تسجيل صنف هالك / تالف جديد */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="تسجيل صنف هالك / تالف (خصم من المخزن واحتساب خسارة)"
        maxWidth="md"
      >
        <form onSubmit={handleSaveDamaged} className="p-4 sm:p-6 space-y-4">
          <div className="p-3 bg-warning-bg border border-warning-border rounded-xl text-xs text-warning leading-relaxed">
            تنبيه مالي: تسجيل الهالك يخصم الكمية فوراً من رصيد المخزون، ويحسب القيمة الإجمالية كخسارة ناتجة عن التوالف في التقارير المالية.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink block">نوع الصنف التالف:</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const p = products[0];
                  setFormData({
                    ...formData,
                    selectionMode: 'product',
                    productId: p?.id || '',
                    unitCost: p ? p.costPrice + p.extraCost : 0,
                  });
                }}
                className={`py-2 px-3 rounded-xl border font-bold transition-colors ${
                  formData.selectionMode === 'product'
                    ? 'bg-truffle text-truffle-ink border-truffle'
                    : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
                }`}
              >
                صنف مسجل بالمخزن
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    selectionMode: 'custom',
                    productId: '',
                    unitCost: 0,
                  })
                }
                className={`py-2 px-3 rounded-xl border font-bold transition-colors ${
                  formData.selectionMode === 'custom'
                    ? 'bg-truffle text-truffle-ink border-truffle'
                    : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
                }`}
              >
                وصف خارجي (مثل: مفتاح مكسور)
              </button>
            </div>
          </div>

          {formData.selectionMode === 'product' ? (
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                اختر الصنف من المخزن <span className="text-danger-text">*</span>
              </label>
              <select
                value={formData.productId}
                onChange={(e) => {
                  const pid = e.target.value;
                  const p = products.find((prod) => prod.id === pid);
                  setFormData({
                    ...formData,
                    productId: pid,
                    unitCost: p ? p.costPrice + p.extraCost : 0,
                  });
                }}
                className="w-full h-11 px-3 text-sm border border-line rounded-xl bg-surface text-ink-strong font-bold focus:outline-none focus:border-flame"
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (رصيد حالي: {p.currentStock} {p.unit}
                    {canViewCost ? ` - تكلفة: ${p.costPrice + p.extraCost} ج.م` : ''})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                اسم الصنف أو وصف الهالك <span className="text-danger-text">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: مفتاح كمبيوتر مكسور أثناء النسخ"
                value={formData.customName}
                onChange={(e) => setFormData({ ...formData, customName: e.target.value })}
                className="w-full h-11 px-3 text-sm border border-line rounded-xl bg-surface text-ink-strong placeholder:text-ink-muted font-bold focus:outline-none focus:border-flame"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                الكمية التالفة <span className="text-danger-text">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                }
                className="w-full h-11 px-3 text-sm border border-line bg-surface text-ink-strong rounded-xl text-center font-bold focus:outline-none focus:border-flame"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                تكلفة الوحدة (ج.م) <span className="text-danger-text">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.unitCost || ''}
                onChange={(e) =>
                  setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })
                }
                className="w-full h-11 px-3 text-sm border border-line bg-surface rounded-xl font-mono font-bold text-danger-text focus:outline-none focus:border-flame"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                سبب الهلاك <span className="text-danger-text">*</span>
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full h-11 px-3 text-xs border border-line rounded-xl bg-surface text-ink-strong font-bold focus:outline-none focus:border-flame"
              >
                <option value="كسر أثناء النسخ أو التجربة">كسر أثناء النسخ أو التجربة</option>
                <option value="تلف مصنعي / عيب صناعة">تلف مصنعي / عيب صناعة</option>
                <option value="تلف أثناء النقل والتخزين">تلف أثناء النقل والتخزين</option>
                <option value="رطوبة / صدأ / سوء حفظ">رطوبة / صدأ / سوء حفظ</option>
                <option value="تجربة غير ناجحة">تجربة غير ناجحة</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                تاريخ حدوث الهالك <span className="text-danger-text">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full h-11 px-3 text-xs border border-line rounded-xl font-bold bg-surface text-ink-strong focus:outline-none focus:border-flame"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">ملاحظات توضيحية</label>
            <input
              type="text"
              placeholder="مثال: تم إتلافه واستبداله للعميل بدون مقابل"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full h-10 px-3 text-xs border border-line rounded-xl bg-surface text-ink-strong placeholder:text-ink-muted focus:outline-none focus:border-flame"
            />
          </div>

          <div className="bg-danger-bg p-3.5 rounded-xl border border-danger-border flex justify-between items-center text-xs">
            <span className="font-bold text-ink-strong">إجمالي خسارة هذا الصنف المحسوبة:</span>
            <span className="font-mono font-black text-base text-danger-text">
              {formatCurrency(formData.quantity * (formData.unitCost || 0))}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-divider">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="danger" size="md" className="font-bold">
              تأكيد تسجيل الهالك وخفض المخزون
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
