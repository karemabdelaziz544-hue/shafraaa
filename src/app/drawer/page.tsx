'use client';

import React, { useState } from 'react';
import {
  Vault,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Smartphone,
  Info,
  RotateCcw,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';

export default function DrawerPage() {
  const {
    ownerName,
    activeDrawer,
    drawerSessions,
    openNewDrawerSession,
    closeDrawerSession,
    reopenDrawerSession,
  } = useShop();

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isOpenNewModalOpen, setIsOpenNewModalOpen] = useState(false);
  const [actualCashInput, setActualCashInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [openingCashInput, setOpeningCashInput] = useState('500');
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [isDrawerSaving, setIsDrawerSaving] = useState(false);

  // حساب الفارق الحي عند إدخال النقدية الفعلية
  const actualNum = parseFloat(actualCashInput) || 0;
  const liveDifference = activeDrawer ? Number((actualNum - activeDrawer.expectedCash).toFixed(2)) : 0;

  const handleCloseDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawer) return;
    setDrawerError(null);
    setIsDrawerSaving(true);
    const res = await closeDrawerSession(actualNum, closingNotes);
    setIsDrawerSaving(false);
    if (!res.ok) {
      setDrawerError(res.error || 'تعذر إغلاق الدرج في قاعدة البيانات');
      return;
    }
    setIsCloseModalOpen(false);
    setActualCashInput('');
    setClosingNotes('');
  };

  const handleOpenNewDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError(null);
    const op = parseFloat(openingCashInput) || 0;
    setIsDrawerSaving(true);
    const res = await openNewDrawerSession(op);
    setIsDrawerSaving(false);
    if (!res.ok) {
      setDrawerError(res.error || 'تعذر فتح وردية الدرج في قاعدة البيانات');
      return;
    }
    setIsOpenNewModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Vault className="w-6 h-6 text-brand-600" />
            <span>تقفيل الدرج اليومي واليومية</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - الرصيد المتوقع = رصيد أول + الوارد النقدي - المنصرف النقدي. المحافظ وإنستاباي تتبع منفصلة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeDrawer ? (
            <Button
              variant="danger"
              size="lg"
              onClick={() => setIsCloseModalOpen(true)}
              className="gap-2 font-bold shadow-md shadow-rose-500/20"
            >
              <Lock className="w-4 h-4" />
              <span>تقفيل اليومية وإغلاق الدرج</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsOpenNewModalOpen(true)}
              className="gap-2 font-bold shadow-md shadow-brand-500/20"
            >
              <Unlock className="w-4 h-4" />
              <span>فتح وردية درج جديدة</span>
            </Button>
          )}
        </div>
      </div>

      {/* بطاقة تفاصيل الدرج المفتوح حاليًا */}
      {activeDrawer ? (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 sm:p-7 rounded-3xl shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-bold text-xs">جلسة الوردية نشطة ومفتوحة</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold mt-1">
                  جلسة رقم #{activeDrawer.sessionNumber}
                </h2>
                <p className="text-xs text-slate-400">
                  فُتحت في: {formatArabicDateTime(activeDrawer.openedAt)}
                </p>
              </div>

              <div className="text-left">
                <span className="text-xs text-slate-400 block">النقدية المتوقعة بالدرج حاليًا</span>
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
                  {formatCurrency(activeDrawer.expectedCash)}
                </span>
              </div>
            </div>

            {/* تفاصيل معادلة الدرج الصارمة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-slate-400 block mb-1">الرصيد الافتتاحي:</span>
                <span className="text-base font-bold text-white font-mono">
                  {formatCurrency(activeDrawer.openingCash)}
                </span>
              </div>

              <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
                <span className="text-emerald-300 block mb-1">إجمالي الوارد كاش (+):</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  +{formatCurrency(
                    activeDrawer.cashSales +
                      activeDrawer.cashDebtPayments
                  )}
                </span>
                <span className="text-[10px] text-emerald-300/70 block mt-0.5">
                  (مبيعات + سداد ديون)
                </span>
              </div>

              <div className="bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
                <span className="text-rose-300 block mb-1">إجمالي المنصرف كاش (-):</span>
                <span className="text-base font-bold text-rose-400 font-mono">
                  -{formatCurrency(
                    activeDrawer.cashExpenses +
                      activeDrawer.cashSupplierPayments +
                      activeDrawer.cashReturns +
                      activeDrawer.cashWithdrawals
                  )}
                </span>
                <span className="text-[10px] text-rose-300/70 block mt-0.5">
                  (مصروفات + موردين + مرتجع + مسحوبات)
                </span>
              </div>

              <div className="bg-purple-500/10 p-3 rounded-2xl border border-purple-500/20">
                <span className="text-purple-300 block mb-1">المحافظ وإنستاباي:</span>
                <span className="text-base font-bold text-purple-300 font-mono">
                  {formatCurrency(activeDrawer.walletTotal + activeDrawer.instapayTotal)}
                </span>
                <span className="text-[10px] text-purple-300/70 block mt-0.5">
                  (محافظ: {activeDrawer.walletTotal} | إنستاباي: {activeDrawer.instapayTotal})
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center bg-amber-50/50 border-amber-200">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-900">الدرج مقفل حاليًا</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            لا توجد جلسة درج مفتوحة حاليًا. افتح جلسة جديدة لبدء عمليات البيع واستلام النقدية اليومية.
          </p>
          <Button variant="primary" size="md" onClick={() => setIsOpenNewModalOpen(true)}>
            <Unlock className="w-4 h-4 ml-1" />
            <span>فتح وردية درج جديدة</span>
          </Button>
        </Card>
      )}

      {/* سجل جلسات الدرج السابقة والمقفلة */}
      <Card>
        <CardHeader>
          <CardTitle>سجل إغلاق الدرج وحالات العجز والزيادة</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {drawerSessions.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              لا توجد جلسات سابقة مسجلة.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 sm:p-4">الجلسة</th>
                  <th className="p-3 sm:p-4">وقت الفتح والإغلاق</th>
                  <th className="p-3 sm:p-4">المتوقع بالدرج</th>
                  <th className="p-3 sm:p-4">الفعلي بالعد</th>
                  <th className="p-3 sm:p-4">الفارق (عجز/زيادة)</th>
                  <th className="p-3 sm:p-4">الحالة</th>
                  <th className="p-3 sm:p-4 text-center">إجراء المالك</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drawerSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sm:p-4 font-mono font-bold text-slate-900">
                      جلسة #{session.sessionNumber}
                    </td>
                    <td className="p-3 sm:p-4 text-slate-500">
                      <p>{formatArabicDateTime(session.openedAt)}</p>
                      {session.closedAt && (
                        <p className="text-[10px] text-slate-400">
                          أغلقت: {formatArabicDateTime(session.closedAt)}
                        </p>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-bold text-slate-900">
                      {formatCurrency(session.expectedCash)}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-black text-brand-700">
                      {session.actualCash !== null && session.actualCash !== undefined
                        ? formatCurrency(session.actualCash)
                        : '-'}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-black">
                      {session.difference !== null && session.difference !== undefined ? (
                        session.difference === 0 ? (
                          <span className="text-emerald-600">مطابق تمامًا (0.00)</span>
                        ) : session.difference < 0 ? (
                          <span className="text-rose-600">عجز: {formatCurrency(session.difference)}</span>
                        ) : (
                          <span className="text-blue-600">زيادة: +{formatCurrency(session.difference)}</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 sm:p-4">
                      {session.status === 'open' ? (
                        <Badge variant="success">مفتوحة حالياً</Badge>
                      ) : (
                        <Badge variant="default">مقفل ومحفوظ</Badge>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      {session.status === 'closed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('بصفتك المالك كريم: هل تريد إعادة فتح هذه الجلسة المغلقة؟')) {
                              reopenDrawerSession(session.id);
                            }
                          }}
                          className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5 ml-1" />
                          <span>إعادة فتح</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* نافذة تقفيل الدرج اليومي */}
      {isCloseModalOpen && activeDrawer && (
        <Dialog
          isOpen={true}
          onClose={() => setIsCloseModalOpen(false)}
          title={`تقفيل الدرج اليومي - جلسة #${activeDrawer.sessionNumber}`}
          maxWidth="md"
        >
          <form onSubmit={handleCloseDrawer} className="space-y-4">
            {drawerError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {drawerError}
              </div>
            )}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">الرصيد المحسوب بالدفاتر (المتوقع):</span>
                <span className="font-black text-slate-900 text-sm">
                  {formatCurrency(activeDrawer.expectedCash)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>المحافظ الإلكترونية (منفصلة):</span>
                <span>{formatCurrency(activeDrawer.walletTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>إنستاباي (منفصل):</span>
                <span>{formatCurrency(activeDrawer.instapayTotal)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                النقدية الفعلية الموجودة في الدرج بعد العد (ج.م) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 px-3 text-lg border rounded-xl font-black text-center text-slate-900 focus:border-brand-500"
              />
            </div>

            {/* إظهار الفارق لحظياً */}
            {actualCashInput && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                  liveDifference === 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : liveDifference < 0
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                <span>نتيجة المطابقة:</span>
                <span className="font-black text-sm">
                  {liveDifference === 0
                    ? 'مطابق تمامًا بدون أي عجز أو زيادة 🎉'
                    : liveDifference < 0
                    ? `عجز في النقدية: ${formatCurrency(liveDifference)} ⚠️`
                    : `زيادة في النقدية: +${formatCurrency(liveDifference)}`}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات التقفيل</label>
              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="ملاحظات حول سبب العجز أو الزيادة إن وجدت"
                className="w-full h-10 px-3 text-xs border rounded-xl"
              />
            </div>

            <Button type="submit" size="xl" variant="danger" isLoading={isDrawerSaving} disabled={isDrawerSaving} className="w-full font-bold">
              <Lock className="w-5 h-5 ml-2" />
              <span>تأكيد الإغلاق وقفل الدرج</span>
            </Button>
          </form>
        </Dialog>
      )}

      {/* نافذة فتح جلسة درج جديدة */}
      {isOpenNewModalOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setIsOpenNewModalOpen(false)}
          title="فتح جلسة درج جديدة"
          maxWidth="sm"
        >
          <form onSubmit={handleOpenNewDrawer} className="space-y-4">
            {drawerError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {drawerError}
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                رصيد الدرج الافتتاحي (الفكة / النقدية المودعة في الدرج) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                placeholder="500"
                className="w-full h-11 px-3 text-base border rounded-xl font-bold text-center"
              />
            </div>

            <Button type="submit" size="lg" variant="primary" isLoading={isDrawerSaving} disabled={isDrawerSaving} className="w-full font-bold">
              فتح الوردية الآن
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
