'use client';

import React, { useRef, useState } from 'react';
import {
  Vault,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button, SaveButtonState } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { FormReportSkeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function DrawerPage() {
  const {
    ownerName,
    activeDrawer,
    drawerSessions,
    openNewDrawerSession,
    closeDrawerSession,
    reopenDrawerSession,
    can,
    isInitialLoading,
  } = useShop();

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isOpenNewModalOpen, setIsOpenNewModalOpen] = useState(false);
  const [actualCashInput, setActualCashInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [openingCashInput, setOpeningCashInput] = useState('500');
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerSaveState, setDrawerSaveState] = useState<SaveButtonState>('idle');
  const drawerLockRef = useRef(false);

  if (isInitialLoading) {
    return <FormReportSkeleton />;
  }

  // حساب الفارق الحي عند إدخال النقدية الفعلية
  const actualNum = parseFloat(actualCashInput) || 0;
  const liveDifference = activeDrawer ? Number((actualNum - activeDrawer.expectedCash).toFixed(2)) : 0;

  const handleCloseDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawer || drawerLockRef.current) return;
    drawerLockRef.current = true;
    setDrawerError(null);
    setDrawerSaveState('saving');
    const res = await closeDrawerSession(actualNum, closingNotes);
    if (!res.ok) {
      setDrawerSaveState('idle');
      drawerLockRef.current = false;
      setDrawerError(res.error || 'تعذر إغلاق الدرج في قاعدة البيانات');
      return;
    }
    setDrawerSaveState('saved');
    setTimeout(() => {
      setDrawerSaveState('idle');
      drawerLockRef.current = false;
      setIsCloseModalOpen(false);
      setActualCashInput('');
      setClosingNotes('');
    }, 450);
  };

  const handleOpenNewDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (drawerLockRef.current) return;
    drawerLockRef.current = true;
    setDrawerError(null);
    const op = parseFloat(openingCashInput) || 0;
    setDrawerSaveState('saving');
    const res = await openNewDrawerSession(op);
    if (!res.ok) {
      setDrawerSaveState('idle');
      drawerLockRef.current = false;
      setDrawerError(res.error || 'تعذر فتح وردية الدرج في قاعدة البيانات');
      return;
    }
    setDrawerSaveState('saved');
    setTimeout(() => {
      setDrawerSaveState('idle');
      drawerLockRef.current = false;
      setIsOpenNewModalOpen(false);
    }, 450);
  };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <Vault strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>تقفيل الدرج اليومي واليومية</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا {ownerName} - الرصيد المتوقع = رصيد أول + الوارد النقدي - المنصرف النقدي. المحافظ وإنستاباي تتبع منفصلة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can('drawer.open_close') &&
            (activeDrawer ? (
              <Button
                variant="danger"
                size="lg"
                onClick={() => setIsCloseModalOpen(true)}
                className="gap-2 font-bold"
              >
                <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                <span>تقفيل اليومية وإغلاق الدرج</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsOpenNewModalOpen(true)}
                className="gap-2 font-bold shadow-accent"
              >
              <Unlock strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
              <span>فتح وردية درج جديدة</span>
            </Button>
            ))}
        </div>
      </div>

      {/* بطاقة تفاصيل الدرج المفتوح حاليًا */}
      {activeDrawer ? (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-abyssal to-fantastic text-palladian p-6 sm:p-7 rounded-3xl shadow-elevated border border-oatmeal/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-oatmeal/25 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-flame animate-pulse" />
                  <span className="text-flame font-bold text-xs">جلسة الوردية نشطة ومفتوحة</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold mt-1 text-palladian">
                  جلسة رقم #{activeDrawer.sessionNumber}
                </h2>
                <p className="text-xs text-oatmeal">
                  فُتحت في: {formatArabicDateTime(activeDrawer.openedAt)}
                </p>
              </div>

              <div className="text-left">
                <span className="text-xs text-oatmeal block">النقدية المتوقعة بالدرج حاليًا</span>
                <span className="text-3xl sm:text-4xl font-black text-flame font-mono">
                  {formatCurrency(activeDrawer.expectedCash)}
                </span>
              </div>
            </div>

            {/* تفاصيل معادلة الدرج الصارمة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
              <div className="bg-abyssal/50 p-3 rounded-2xl border border-oatmeal/20">
                <span className="text-oatmeal block mb-1">الرصيد الافتتاحي:</span>
                <span className="text-base font-bold text-palladian font-mono">
                  {formatCurrency(activeDrawer.openingCash)}
                </span>
              </div>

              <div className="bg-success-bg/20 p-3 rounded-2xl border border-success-border/40">
                <span className="text-palladian/90 block mb-1">إجمالي الوارد كاش (+):</span>
                <span className="text-base font-bold text-flame font-mono">
                  +{formatCurrency(activeDrawer.cashSales + activeDrawer.cashDebtPayments)}
                </span>
                <span className="text-[10px] text-oatmeal block mt-0.5">
                  (مبيعات + سداد ديون)
                </span>
              </div>

              <div className="bg-truffle/30 p-3 rounded-2xl border border-truffle/60">
                <span className="text-palladian/90 block mb-1">إجمالي المنصرف كاش (-):</span>
                <span className="text-base font-bold text-palladian font-mono">
                  -{formatCurrency(
                    activeDrawer.cashExpenses +
                      activeDrawer.cashSupplierPayments +
                      activeDrawer.cashReturns +
                      activeDrawer.cashWithdrawals
                  )}
                </span>
                <span className="text-[10px] text-oatmeal block mt-0.5">
                  (مصروفات + موردين + مرتجع + مسحوبات)
                </span>
              </div>

              <div className="bg-abyssal/45 p-3 rounded-2xl border border-flame/35">
                <span className="text-oatmeal block mb-1">المحافظ وإنستاباي:</span>
                <span className="text-base font-bold text-flame font-mono">
                  {formatCurrency(activeDrawer.walletTotal + activeDrawer.instapayTotal)}
                </span>
                <span className="text-[10px] text-oatmeal block mt-0.5">
                  (محافظ: {activeDrawer.walletTotal} | إنستاباي: {activeDrawer.instapayTotal})
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center bg-warning-bg/60 border-warning-border">
          <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-10 h-10 text-warning mx-auto mb-2" />
          <h3 className="text-base font-bold text-ink-strong">الدرج مقفل حاليًا</h3>
          <p className="text-xs text-ink-muted max-w-md mx-auto mt-1 mb-4">
            لا توجد جلسة درج مفتوحة حاليًا. افتح جلسة جديدة لبدء عمليات البيع واستلام النقدية اليومية.
          </p>
          {can('drawer.open_close') && (
            <Button variant="primary" size="md" onClick={() => setIsOpenNewModalOpen(true)}>
              <Unlock strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1" />
              <span>فتح وردية درج جديدة</span>
            </Button>
          )}
        </Card>
      )}

      {/* سجل جلسات الدرج السابقة والمقفلة */}
      <Card>
        <CardHeader>
          <CardTitle>سجل إغلاق الدرج وحالات العجز والزيادة</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {drawerSessions.length === 0 ? (
            <div className="p-10 text-center text-ink-muted text-xs">
              لا توجد جلسات سابقة مسجلة.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-surface-alt text-ink font-bold border-b border-line">
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
              <tbody className="divide-y divide-divider">
                {drawerSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-surface-alt/60 transition-colors">
                    <td className="p-3 sm:p-4 font-mono font-bold text-ink-strong">
                      جلسة #{session.sessionNumber}
                    </td>
                    <td className="p-3 sm:p-4 text-ink-muted">
                      <p>{formatArabicDateTime(session.openedAt)}</p>
                      {session.closedAt && (
                        <p className="text-[10px] text-ink-muted">
                          أغلقت: {formatArabicDateTime(session.closedAt)}
                        </p>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-bold text-ink-strong">
                      {formatCurrency(session.expectedCash)}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-black text-truffle dark:text-flame">
                      {session.actualCash !== null && session.actualCash !== undefined
                        ? formatCurrency(session.actualCash)
                        : '-'}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-black">
                      {session.difference !== null && session.difference !== undefined ? (
                        session.difference === 0 ? (
                          <span className="text-success">مطابق تمامًا (0.00)</span>
                        ) : session.difference < 0 ? (
                          <span className="text-danger-text">عجز: {formatCurrency(session.difference)}</span>
                        ) : (
                          <span className="text-ink-strong">زيادة: +{formatCurrency(session.difference)}</span>
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
                      {session.status === 'closed' && can('drawer.reopen') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('هل تريد إعادة فتح هذه الجلسة المغلقة؟')) {
                              reopenDrawerSession(session.id);
                            }
                          }}
                          className="text-xs text-warning border-warning-border hover:bg-warning-bg"
                        >
                          <RotateCcw strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 ml-1" />
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
              <div className="p-3 rounded-xl bg-danger-bg border border-danger-border text-danger-text text-xs font-bold">
                {drawerError}
              </div>
            )}
            <div className="bg-surface-alt p-3.5 rounded-2xl border border-line text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-ink-muted">الرصيد المحسوب بالدفاتر (المتوقع):</span>
                <span className="font-black text-ink-strong text-sm">
                  {formatCurrency(activeDrawer.expectedCash)}
                </span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>المحافظ الإلكترونية (منفصلة):</span>
                <span>{formatCurrency(activeDrawer.walletTotal)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>إنستاباي (منفصل):</span>
                <span>{formatCurrency(activeDrawer.instapayTotal)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">
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
                className="w-full h-12 px-3 text-lg border border-line bg-surface rounded-xl font-black text-center text-ink-strong focus:outline-none focus:border-flame focus:ring-2 focus:ring-flame/25"
              />
            </div>

            {/* إظهار الفارق لحظياً */}
            {actualCashInput && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                  liveDifference === 0
                    ? 'bg-success-bg text-success border-success-border'
                    : liveDifference < 0
                    ? 'bg-danger-bg text-danger-text border-danger-border'
                    : 'bg-info-bg text-ink-strong border-info-border'
                }`}
              >
                <span>نتيجة المطابقة:</span>
                <span className="font-black text-sm inline-flex items-center gap-1.5">
                  {liveDifference === 0 ? (
                    <>
                      <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 shrink-0" />
                      <span>مطابق تمامًا بدون أي عجز أو زيادة</span>
                    </>
                  ) : liveDifference < 0 ? (
                    <>
                      <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 shrink-0" />
                      <span>عجز في النقدية: {formatCurrency(liveDifference)}</span>
                    </>
                  ) : (
                    <span>زيادة في النقدية: +{formatCurrency(liveDifference)}</span>
                  )}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-ink block mb-1">ملاحظات التقفيل</label>
              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="ملاحظات حول سبب العجز أو الزيادة إن وجدت"
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
              />
            </div>

            <Button type="submit" size="xl" variant="danger" saveState={drawerSaveState} savedText="تم الإغلاق" className="w-full font-bold">
              <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 ml-2" />
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
              <div className="p-3 rounded-xl bg-danger-bg border border-danger-border text-danger-text text-xs font-bold">
                {drawerError}
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
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
                className="w-full h-11 px-3 text-base border border-line bg-surface text-ink-strong rounded-xl font-bold text-center focus:outline-none focus:border-flame"
              />
            </div>

            <Button type="submit" size="lg" variant="primary" saveState={drawerSaveState} savedText="تم الفتح" className="w-full font-bold">
              فتح الوردية الآن
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
