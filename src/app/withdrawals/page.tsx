'use client';

import React, { useState } from 'react';
import {
  WalletCards,
  Plus,
  User,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { formatCurrency, formatArabicDate } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function WithdrawalsPage() {
  const { ownerName, ownerWithdrawals, addOwnerWithdrawal, can, isInitialLoading } = useShop();

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0 || !formData.reason.trim()) return;

    const res = await addOwnerWithdrawal(formData);
    if (!res.ok) {
      alert(res.error || 'تعذر حفظ مسحوبات المالك في قاعدة البيانات');
      return;
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <WalletCards strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>مسحوبات المالك الشخصية ({ownerName})</span>
          </h1>
          <p className="text-xs text-ink-muted">
            قاعدة محاسبية صارمة: مسحوبات المالك تخصم من النقدية، لكنها لا تعتبر مصروفاً في قائمة الدخل!
          </p>
        </div>

        {can('withdrawals.create') && (
          <Button variant="primary" size="md" onClick={() => setIsAddModalOpen(true)}>
            <Plus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1" />
            <span>تسجيل سحب شخصي</span>
          </Button>
        )}
      </div>

      <div className="bg-warning-bg border border-warning-border p-4 rounded-2xl flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-warning">إجمالي مسحوبات كريم المسجلة</span>
          <p className="text-xl font-black text-ink-strong">{formatCurrency(totalWithdrawals)}</p>
        </div>
        <User strokeWidth={ICON_TOKENS.strokeWidth} className="w-8 h-8 text-warning" />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isInitialLoading ? (
            <TableSkeletonRows columns={4} rows={4} />
          ) : ownerWithdrawals.length === 0 ? (
            <div className="p-10 text-center text-ink-muted text-xs">
              لا توجد مسحوبات شخصية مسجلة.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                <tr>
                  <th className="p-3 sm:p-4">التاريخ</th>
                  <th className="p-3 sm:p-4">المالك</th>
                  <th className="p-3 sm:p-4">المبلغ المسحوب</th>
                  <th className="p-3 sm:p-4">طريقة السحب</th>
                  <th className="p-3 sm:p-4">السبب / الغرض</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {ownerWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-surface-alt/60 transition-colors">
                    <td className="p-3 sm:p-4 font-mono text-ink-muted">{formatArabicDate(w.date)}</td>
                    <td className="p-3 sm:p-4 font-bold text-ink-strong">{w.ownerName}</td>
                    <td className="p-3 sm:p-4 font-mono font-black text-danger-text">
                      -{formatCurrency(w.amount)}
                    </td>
                    <td className="p-3 sm:p-4 text-ink-muted">{w.paymentMethod}</td>
                    <td className="p-3 sm:p-4 text-ink">{w.reason}</td>
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
            <div className="p-3 bg-info-bg border border-info-border rounded-xl text-xs text-ink-strong">
              تذكير: هذا المبلغ يخصم من نقدية الدرج أو المحفظة لكنه محفوظ بشكل مستقل ولا يقلل من صافي أرباح مبيعاتك.
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">المبلغ المطلوب سحبه (ج.م) *</label>
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
                <label className="text-xs font-bold text-ink block mb-1">جهة السحب</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e: any) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
                >
                  <option value="cash">نقدًا من الدرج (يخصم من كاش اليومية)</option>
                  <option value="wallet">محفظة إلكترونية</option>
                  <option value="instapay">إنستاباي</option>
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
              <label className="text-xs font-bold text-ink block mb-1">سبب / غرض السحب *</label>
              <input
                type="text"
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="مثال: مصاريف بيت شخصية"
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
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
