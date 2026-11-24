'use client';

import React, { useState } from 'react';
import {
  WalletCards,
  Plus,
  Calendar,
  AlertCircle,
  DollarSign,
  User,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { formatCurrency, formatArabicDate } from '@/lib/formatters';

export default function WithdrawalsPage() {
  const { ownerName, ownerWithdrawals, addOwnerWithdrawal } = useShop();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<{
    amount: number;
    paymentMethod: 'cash' | 'wallet' | 'instapay';
    date: string;
    reason: string;
  }>({
    amount: 0,
    paymentMethod: 'cash',
    date: new Date().toISOString().split('T')[0],
    reason: 'مصاريف شخصية',
  });

  const totalWithdrawals = ownerWithdrawals.reduce((sum, w) => sum + w.amount, 0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0 || !formData.reason.trim()) return;

    addOwnerWithdrawal(formData);
    setIsAddModalOpen(false);
    setFormData({
      amount: 0,
      paymentMethod: 'cash',
      date: new Date().toISOString().split('T')[0],
      reason: 'مصاريف شخصية',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <WalletCards className="w-6 h-6 text-brand-600" />
            <span>مسحوبات المالك الشخصية ({ownerName})</span>
          </h1>
          <p className="text-xs text-slate-500">
            قاعدة محاسبية صارمة: مسحوبات المالك تخصم من النقدية، لكنها لا تعتبر مصروفاً في قائمة الدخل!
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 ml-1" />
          <span>تسجيل سحب شخصي</span>
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-amber-800">إجمالي مسحوبات كريم المسجلة</span>
          <p className="text-xl font-black text-amber-700">{formatCurrency(totalWithdrawals)}</p>
        </div>
        <User className="w-8 h-8 text-amber-600" />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {ownerWithdrawals.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              لا توجد مسحوبات شخصية مسجلة.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 sm:p-4">التاريخ</th>
                  <th className="p-3 sm:p-4">المالك</th>
                  <th className="p-3 sm:p-4">المبلغ المسحوب</th>
                  <th className="p-3 sm:p-4">طريقة السحب</th>
                  <th className="p-3 sm:p-4">السبب / الغرض</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownerWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/80">
                    <td className="p-3 sm:p-4 font-mono">{formatArabicDate(w.date)}</td>
                    <td className="p-3 sm:p-4 font-bold text-slate-900">{w.ownerName}</td>
                    <td className="p-3 sm:p-4 font-mono font-black text-rose-600">
                      -{formatCurrency(w.amount)}
                    </td>
                    <td className="p-3 sm:p-4 text-slate-600">{w.paymentMethod}</td>
                    <td className="p-3 sm:p-4 text-slate-700">{w.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* نافذة تسجيل سحب شخصي */}
      {isAddModalOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title={`تسجيل مسحوبات شخصية للمالك (${ownerName})`}
          maxWidth="md"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
              تذكير: هذا المبلغ يخصم من نقدية الدرج أو المحفظة لكنه محفوظ بشكل مستقل ولا يقلل من صافي أرباح مبيعاتك.
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ المطلوب سحبه (ج.م) *</label>
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
                <label className="text-xs font-bold text-slate-700 block mb-1">جهة السحب</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e: any) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full h-10 px-3 text-xs border rounded-xl"
                >
                  <option value="cash">نقدًا من الدرج (يخصم من كاش اليومية)</option>
                  <option value="wallet">محفظة إلكترونية</option>
                  <option value="instapay">إنستاباي</option>
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
              <label className="text-xs font-bold text-slate-700 block mb-1">سبب / غرض السحب *</label>
              <input
                type="text"
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="مثال: مصاريف بيت شخصية"
                className="w-full h-10 px-3 text-xs border rounded-xl"
              />
            </div>

            <Button type="submit" size="lg" variant="danger" className="w-full font-bold">
              تأكيد سحب المبلغ
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
