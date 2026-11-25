'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { useShop, Customer } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function CustomersPage() {
  const { customers, salesInvoices, addCustomer, addCustomerPayment, can, isInitialLoading } = useShop();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'instapay'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phone: '',
    creditLimit: 0,
    initialBalance: 0,
    notes: '',
  });

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerData.name.trim()) return;

    const res = await addCustomer({
      name: newCustomerData.name.trim(),
      phone: newCustomerData.phone.trim(),
      creditLimit: newCustomerData.creditLimit,
      initialBalance: newCustomerData.initialBalance,
      notes: newCustomerData.notes,
    });

    if (!res.ok) {
      alert(res.error || 'تعذر حفظ العميل في قاعدة البيانات');
      return;
    }

    setIsAddModalOpen(false);
    setNewCustomerData({ name: '', phone: '', creditLimit: 0, initialBalance: 0, notes: '' });
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) return;

    const res = await addCustomerPayment(selectedCustomer.id, amt, paymentMethod, paymentNotes);
    if (!res.ok) {
      alert(res.error || 'تعذر تسجيل الدفعة في قاعدة البيانات');
      return;
    }
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentNotes('');
  };

  const customerInvoices = selectedCustomer
    ? salesInvoices.filter((inv) => inv.customerId === selectedCustomer.id)
    : [];

  return (
    <div className="space-y-5">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <Users strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>العملاء وحسابات الديون والائتمان</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا كريم - متابعة دقيقة لسقف ائتمان كل عميل ومديونياته وتحصيل الدفعات
          </p>
        </div>

        {can('customers.create') && (
          <Button variant="primary" size="md" onClick={() => setIsAddModalOpen(true)}>
            <Plus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1" />
            <span>إضافة عميل جديد</span>
          </Button>
        )}
      </div>

      {/* البحث */}
      <div className="relative">
        <Search strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-ink-muted absolute right-3.5 top-3" />
        <input
          type="text"
          placeholder="ابحث باسم العميل أو رقم هاتفه..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pr-11 pl-4 rounded-xl border border-line bg-surface text-ink-strong placeholder:text-ink-muted text-sm focus:border-flame focus:outline-none focus:ring-2 focus:ring-flame/25"
        />
      </div>

      {/* جدول العملاء */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isInitialLoading ? (
            <TableSkeletonRows columns={5} rows={5} />
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-ink-muted text-sm">
              لا يوجد عملاء مسجلين حالياً.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                <tr>
                  <th className="p-3 sm:p-4">اسم العميل</th>
                  <th className="p-3 sm:p-4">الهاتف</th>
                  <th className="p-3 sm:p-4">حد الائتمان</th>
                  <th className="p-3 sm:p-4">المديونية الحالية</th>
                  <th className="p-3 sm:p-4">حالة الحساب</th>
                  <th className="p-3 sm:p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filteredCustomers.map((c) => {
                  const isOverLimit = c.creditLimit > 0 && c.currentBalance > c.creditLimit;
                  return (
                    <tr key={c.id} className="hover:bg-surface-alt/60 transition-colors">
                      <td className="p-3 sm:p-4">
                        <p className="font-bold text-ink-strong">{c.name}</p>
                        {c.notes && <p className="text-[11px] text-ink-muted">{c.notes}</p>}
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-ink-muted">
                        {c.phone || 'غير مسجل'}
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-ink-muted">
                        {c.creditLimit > 0 ? formatCurrency(c.creditLimit) : 'غير محدد'}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-black text-danger-text">
                        {formatCurrency(c.currentBalance)}
                      </td>
                      <td className="p-3 sm:p-4">
                        {isOverLimit ? (
                          <Badge variant="danger" className="gap-1">
                            <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                            <span>تجاوز الحد بمبلغ {formatCurrency(c.currentBalance - c.creditLimit)}</span>
                          </Badge>
                        ) : c.currentBalance > 0 ? (
                          <Badge variant="warning">عليه مديونية</Badge>
                        ) : (
                          <Badge variant="success">خالص</Badge>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {c.currentBalance > 0 && can('customers.collect_payment') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setIsPaymentModalOpen(true);
                              }}
                              className="text-success border-success-border hover:bg-success-bg"
                            >
                              <DollarSign strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 ml-1" />
                              <span>تحصيل دفعة</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCustomer(c)}
                            className="text-truffle dark:text-flame text-xs font-bold"
                          >
                            كشف الحساب
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* نافذة كشف الحساب */}
      {selectedCustomer && !isPaymentModalOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectedCustomer(null)}
          title={`كشف حساب العميل: ${selectedCustomer.name}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 bg-surface-alt border border-line p-3 rounded-xl text-xs">
              <div>
                <span className="text-ink-muted">الهاتف:</span>
                <p className="font-bold text-ink-strong">{selectedCustomer.phone || '-'}</p>
              </div>
              <div>
                <span className="text-ink-muted">حد الائتمان:</span>
                <p className="font-bold text-ink-strong">{formatCurrency(selectedCustomer.creditLimit)}</p>
              </div>
              <div>
                <span className="text-ink-muted">الرصيد المستحق الحالي:</span>
                <p className="font-black text-danger-text">{formatCurrency(selectedCustomer.currentBalance)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-ink-strong mb-2">فواتير ومشتريات العميل:</h4>
              {customerInvoices.length === 0 ? (
                <div className="p-6 text-center text-ink-muted text-xs bg-surface-alt border border-line rounded-xl">
                  لا توجد فواتير سابقة مسجلة باسم هذا العميل.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-divider">
                  {customerInvoices.map((inv) => (
                    <div key={inv.id} className="pt-2 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-ink-strong">{inv.invoiceNumber}</p>
                        <p className="text-[10px] text-ink-muted">{formatArabicDateTime(inv.createdAt)}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-ink-strong">{formatCurrency(inv.totalAmount)}</p>
                        {inv.remainingAmount > 0 ? (
                          <p className="text-[10px] text-danger-text font-bold">متبقي: {formatCurrency(inv.remainingAmount)}</p>
                        ) : (
                          <p className="text-[10px] text-success font-bold">مسدد بالكامل</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* نافذة تحصيل دفعة من العميل */}
      {isPaymentModalOpen && selectedCustomer && (
        <Dialog
          isOpen={true}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`تحصيل سداد دين: ${selectedCustomer.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleConfirmPayment} className="space-y-4">
            <div className="bg-danger-bg p-3 rounded-xl border border-danger-border text-xs flex justify-between text-ink-strong">
              <span>إجمالي الدين الحالي على العميل:</span>
              <span className="font-black text-danger-text">{formatCurrency(selectedCustomer.currentBalance)}</span>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">المبلغ المحصل (ج.م) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedCustomer.currentBalance}
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-11 px-3 text-sm border border-line bg-surface rounded-xl font-black text-success focus:outline-none focus:border-flame"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">طريقة استلام المبلغ</label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
              >
                <option value="cash">نقدًا (يدخل في درج اليومية كاش)</option>
                <option value="wallet">محفظة إلكترونية (فودافون كاش / أورنج)</option>
                <option value="instapay">تحويل إنستاباي</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">ملاحظات التحصيل</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="مثال: دفعة من حساب الفاتورة السابقة"
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
              />
            </div>

            <Button type="submit" size="lg" variant="success" className="w-full font-bold">
              تأكيد تحصيل المبلغ
            </Button>
          </form>
        </Dialog>
      )}

      {/* نافذة إضافة عميل جديد */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="إضافة عميل جديد"
        maxWidth="md"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-ink block mb-1">اسم العميل *</label>
            <input
              type="text"
              required
              value={newCustomerData.name}
              onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
              placeholder="مثال: م. أحمد عبد العزيز"
              className="w-full h-11 px-3 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">رقم الهاتف / الموبايل</label>
            <input
              type="text"
              value={newCustomerData.phone}
              onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
              placeholder="01xxxxxxxxx"
              className="w-full h-11 px-3 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">سقف الائتمان (أقصى دين مسموح)</label>
              <input
                type="number"
                min="0"
                value={newCustomerData.creditLimit || ''}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, creditLimit: parseFloat(e.target.value) || 0 })}
                placeholder="مثال: 1000"
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">الرصيد الافتتاحي (دين قديم إن وجد)</label>
              <input
                type="number"
                min="0"
                value={newCustomerData.initialBalance || ''}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, initialBalance: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">ملاحظات</label>
            <input
              type="text"
              value={newCustomerData.notes}
              onChange={(e) => setNewCustomerData({ ...newCustomerData, notes: e.target.value })}
              placeholder="ملاحظات حول عنوان العميل أو أوقات السداد"
              className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
            />
          </div>

          <div className="pt-2 border-t border-divider flex justify-end gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setIsAddModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="md">
              حفظ العميل
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
