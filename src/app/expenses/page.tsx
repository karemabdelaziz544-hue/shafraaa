'use client';

import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Calendar,
  Filter,
  DollarSign,
  TrendingDown,
  Info,
} from 'lucide-react';
import { useShop, Expense } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { formatCurrency, formatArabicDate } from '@/lib/formatters';

export default function ExpensesPage() {
  const { expenses, addExpense } = useShop();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'fixed' | 'variable'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

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

  // تصفية المصروفات حسب الشهر والنوع
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-brand-600" />
            <span>المصروفات (الثابتة والمتغيرة)</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - المصروفات الثابتة (إيجار، كهرباء) تخصم مرة واحدة فقط عند حساب صافي أرباح الشهر
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 ml-1" />
          <span>تسجيل مصروف جديد</span>
        </Button>
      </div>

      {/* بطاقات الإجماليات للشهر المحدد */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* إجمالي المصروفات */}
        <Card className="border-rose-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">إجمالي مصروفات الشهر</span>
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600">
              {formatCurrency(totalAll)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              عن شهر: <span className="font-bold">{selectedMonth}</span>
            </p>
          </CardContent>
        </Card>

        {/* المصروفات الثابتة */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">المصروفات الثابتة (تخصم مرة بالدورة)</span>
              <Badge variant="purple">إيجار، رواتب، كهرباء</Badge>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-700">
              {formatCurrency(totalFixed)}
            </div>
            <p className="text-xs text-slate-500 mt-1">تخصم مرة واحدة في قائمة الدخل</p>
          </CardContent>
        </Card>

        {/* المصروفات المتغيرة */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">المصروفات التشغيلية المتغيرة</span>
              <Badge variant="warning">نقل، بوفيه، أكياس</Badge>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">
              {formatCurrency(totalVariable)}
            </div>
            <p className="text-xs text-slate-500 mt-1">مرتبطة بحركة البيع اليومية</p>
          </CardContent>
        </Card>
      </div>

      {/* الفلترة والتاريخ */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">الشهر:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-3 text-xs border rounded-lg bg-slate-50 font-bold"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filterType === 'all'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            الكل ({monthlyExpenses.length})
          </button>
          <button
            onClick={() => setFilterType('fixed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filterType === 'fixed'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            الثابتة
          </button>
          <button
            onClick={() => setFilterType('variable')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filterType === 'variable'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            المتغيرة
          </button>
        </div>
      </div>

      {/* جدول المصروفات */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              لا توجد مصروفات مسجلة في هذا الشهر.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 sm:p-4">التاريخ</th>
                  <th className="p-3 sm:p-4">بند المصروف</th>
                  <th className="p-3 sm:p-4">النوع</th>
                  <th className="p-3 sm:p-4">طريقة الدفع</th>
                  <th className="p-3 sm:p-4">المبلغ</th>
                  <th className="p-3 sm:p-4">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sm:p-4 font-mono font-medium text-slate-600">
                      {formatArabicDate(exp.date)}
                    </td>
                    <td className="p-3 sm:p-4 font-bold text-slate-900">{exp.category}</td>
                    <td className="p-3 sm:p-4">
                      <Badge variant={exp.type === 'fixed' ? 'purple' : 'warning'}>
                        {exp.type === 'fixed' ? 'ثابت (شهري)' : 'متغير'}
                      </Badge>
                    </td>
                    <td className="p-3 sm:p-4 font-medium text-slate-600">
                      {exp.paymentMethod === 'cash' ? 'نقدًا من الدرج' : exp.paymentMethod}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-black text-rose-600">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="p-3 sm:p-4 text-slate-500 text-xs">
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
            <label className="text-xs font-bold text-slate-700 block mb-1">نوع المصروف *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'variable' })}
                className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                  formData.type === 'variable'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                مصروف متغير (بوفيه، نقل، صيانة، أكياس)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'fixed' })}
                className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                  formData.type === 'fixed'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                مصروف ثابت (إيجار، كهرباء، مرتب، نت)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">بند المصروف / البيان *</label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="مثال: فاتورة كهرباء المحل أو أكياس وتغليف"
              className="w-full h-11 px-3 text-sm border rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ (ج.م) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="w-full h-11 px-3 text-sm border rounded-xl font-black text-rose-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">طريقة الصرف</label>
              <select
                value={formData.paymentMethod}
                onChange={(e: any) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full h-10 px-3 text-xs border rounded-xl"
              >
                <option value="cash">نقدًا من الدرج (يخصم من كاش اليومية)</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="instapay">إنستاباي</option>
                <option value="bank">حساب بنكي</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">التاريخ</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full h-10 px-3 text-xs border rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات إضافية</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="رقم الفاتورة أو اسم المستلم إن وجد"
              className="w-full h-10 px-3 text-xs border rounded-xl"
            />
          </div>

          <div className="pt-2 border-t flex justify-end gap-2">
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
