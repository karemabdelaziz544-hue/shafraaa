'use client';

import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Calendar,
  TrendingDown,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { formatCurrency, formatArabicDate } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function ExpensesPage() {
  const { expenses, addExpense, can, isInitialLoading } = useShop();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'fixed' | 'variable'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const [formData, setFormData] = useState<{
    type: 'fixed' | 'variable';
    category: string;
    amount: number;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'bank';
    date: string;
    notes: string;
  }>({
    type: 'variable',
    category: 'نثريات وبوفيه',
    amount: 0,
    paymentMethod: 'cash',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const monthlyExpenses = expenses.filter((e) => e.date.startsWith(selectedMonth));
  const filteredExpenses = monthlyExpenses.filter((e) => {
    if (filterType === 'all') return true;
    return e.type === filterType;
  });

  const totalFixed = monthlyExpenses
    .filter((e) => e.type === 'fixed')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalVariable = monthlyExpenses
    .filter((e) => e.type === 'variable')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalAll = totalFixed + totalVariable;

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category.trim() || formData.amount <= 0) return;

    const res = await addExpense({
      type: formData.type,
      category: formData.category.trim(),
      amount: formData.amount,
      paymentMethod: formData.paymentMethod,
      date: formData.date,
      notes: formData.notes,
    });

    if (!res.ok) {
      alert(res.error || 'تعذر حفظ المصروف في قاعدة البيانات');
      return;
    }

    setIsAddModalOpen(false);
    setFormData({
      type: 'variable',
      category: 'نثريات وبوفيه',
      amount: 0,
      paymentMethod: 'cash',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <Receipt strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>المصروفات (الثابتة والمتغيرة)</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا كريم - المصروفات الثابتة (إيجار، كهرباء) تخصم مرة واحدة فقط عند حساب صافي أرباح الشهر
          </p>
        </div>

        {can('expenses.create') && (
          <Button variant="primary" size="md" onClick={() => setIsAddModalOpen(true)}>
            <Plus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1" />
            <span>تسجيل مصروف جديد</span>
          </Button>
        )}
      </div>

      {/* بطاقات الإجماليات للشهر المحدد */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-danger-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">إجمالي مصروفات الشهر</span>
              <TrendingDown strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-danger-text" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-danger-text">
              {formatCurrency(totalAll)}
            </div>
            <p className="text-xs text-ink-muted mt-1">
              عن شهر: <span className="font-bold text-ink-strong">{selectedMonth}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">المصروفات الثابتة (تخصم مرة بالدورة)</span>
              <Badge variant="info">إيجار، رواتب، كهرباء</Badge>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-ink-strong">
              {formatCurrency(totalFixed)}
            </div>
            <p className="text-xs text-ink-muted mt-1">تخصم مرة واحدة في قائمة الدخل</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-muted">المصروفات التشغيلية المتغيرة</span>
              <Badge variant="warning">نقل، بوفيه، أكياس</Badge>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-warning">
              {formatCurrency(totalVariable)}
            </div>
            <p className="text-xs text-ink-muted mt-1">مرتبطة بحركة البيع اليومية</p>
          </CardContent>
        </Card>
      </div>

      {/* الفلترة والتاريخ */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface p-3 rounded-2xl border border-line">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Calendar strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted" />
          <span className="text-xs font-bold text-ink">الشهر:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-3 text-xs border border-line rounded-lg bg-surface-alt text-ink-strong font-bold focus:outline-none focus:border-flame"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              filterType === 'all'
                ? 'bg-flame text-abyssal border-flame'
                : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
            }`}
          >
            الكل ({monthlyExpenses.length})
          </button>
          <button
            onClick={() => setFilterType('fixed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              filterType === 'fixed'
                ? 'bg-fantastic text-palladian border-fantastic'
                : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
            }`}
          >
            الثابتة
          </button>
          <button
            onClick={() => setFilterType('variable')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              filterType === 'variable'
                ? 'bg-truffle text-truffle-ink border-truffle'
                : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
            }`}
          >
            المتغيرة
          </button>
        </div>
      </div>

      {/* جدول المصروفات */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isInitialLoading ? (
            <TableSkeletonRows columns={5} rows={5} />
          ) : filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-ink-muted text-sm">
              لا توجد مصروفات مسجلة في هذا الشهر.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                <tr>
                  <th className="p-3 sm:p-4">التاريخ</th>
                  <th className="p-3 sm:p-4">بند المصروف</th>
                  <th className="p-3 sm:p-4">النوع</th>
                  <th className="p-3 sm:p-4">طريقة الدفع</th>
                  <th className="p-3 sm:p-4">المبلغ</th>
                  <th className="p-3 sm:p-4">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-surface-alt/60 transition-colors">
                    <td className="p-3 sm:p-4 font-mono font-medium text-ink-muted">
                      {formatArabicDate(exp.date)}
                    </td>
                    <td className="p-3 sm:p-4 font-bold text-ink-strong">{exp.category}</td>
                    <td className="p-3 sm:p-4">
                      <Badge variant={exp.type === 'fixed' ? 'info' : 'warning'}>
                        {exp.type === 'fixed' ? 'ثابت (شهري)' : 'متغير'}
                      </Badge>
                    </td>
                    <td className="p-3 sm:p-4 font-medium text-ink-muted">
                      {exp.paymentMethod === 'cash' ? 'نقدًا من الدرج' : exp.paymentMethod}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-black text-danger-text">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="p-3 sm:p-4 text-ink-muted text-xs">
                      {exp.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* نافذة إضافة مصروف جديد */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="تسجيل مصروف جديد"
        maxWidth="md"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-ink block mb-1">نوع المصروف *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'variable' })}
                className={`p-3 rounded-xl border text-xs font-bold transition-colors ${
                  formData.type === 'variable'
                    ? 'bg-flame text-abyssal border-flame'
                    : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
                }`}
              >
                مصروف متغير (بوفيه، نقل، صيانة، أكياس)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'fixed' })}
                className={`p-3 rounded-xl border text-xs font-bold transition-colors ${
                  formData.type === 'fixed'
                    ? 'bg-fantastic text-palladian border-fantastic'
                    : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
                }`}
              >
                مصروف ثابت (إيجار، كهرباء، مرتب، نت)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">بند المصروف / البيان *</label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="مثال: فاتورة كهرباء المحل أو أكياس وتغليف"
              className="w-full h-11 px-3 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">المبلغ (ج.م) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="w-full h-11 px-3 text-sm border border-line bg-surface rounded-xl font-black text-danger-text focus:outline-none focus:border-flame"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">طريقة الصرف</label>
              <select
                value={formData.paymentMethod}
                onChange={(e: any) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
              >
                <option value="cash">نقدًا من الدرج (يخصم من كاش اليومية)</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="instapay">إنستاباي</option>
                <option value="bank">حساب بنكي</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">التاريخ</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">ملاحظات إضافية</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="رقم الفاتورة أو اسم المستلم إن وجد"
              className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
            />
          </div>

          <div className="pt-2 border-t border-divider flex justify-end gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setIsAddModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="danger" size="md">
              حفظ وصرف المصروف
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
