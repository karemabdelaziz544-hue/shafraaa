'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ScrollText,
  Plus,
  Search,
  RotateCcw,
  Printer,
  AlertCircle,
  History,
  CheckCircle2,
} from 'lucide-react';
import { useShop, SaleInvoice, SaleInvoiceItem } from '@/lib/store/shop-store';
import { validateSaleReturnRequest, calculateReturnableLineState } from '@/lib/calculations';
import { Button, SaveButtonState } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

const InvoicePrintView = dynamic(
  () => import('@/components/invoice-print-view').then((mod) => mod.InvoicePrintView),
  { ssr: false }
);

function getInvoiceStatusBadge(status: SaleInvoice['status']) {
  if (status === 'returned_full') {
    return <Badge variant="danger">مرتجع بالكامل</Badge>;
  }
  if (status === 'returned_partial') {
    return <Badge variant="warning">مرتجع جزئي</Badge>;
  }
  if (status === 'cancelled') {
    return <Badge variant="default">ملغاة</Badge>;
  }
  return <Badge variant="success">مكتملة</Badge>;
}

export default function SalesHistoryPage() {
  const { salesInvoices, salesReturns, ownerName, createSaleReturn, can, isInitialLoading } = useShop();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<SaleInvoice | null>(null);

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnSaveState, setReturnSaveState] = useState<SaveButtonState>('idle');
  const returnLockRef = useRef(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);
  const [returnItem, setReturnItem] = useState<{
    invoiceId: string;
    invoiceItemId: string;
    productId: string;
    productName: string;
    soldQty: number;
    alreadyReturnedQty: number;
    remainingQty: number;
    unitPrice: number;
    quantityInput: string;
    isSellable: boolean;
    reason: string;
    refundMethod: 'cash' | 'wallet' | 'instapay' | 'credit';
  } | null>(null);

  const selectedInvoice = selectedInvoiceId
    ? salesInvoices.find((inv) => inv.id === selectedInvoiceId) || null
    : null;

  const filteredInvoices = salesInvoices.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.paymentMethod.toLowerCase().includes(q)
    );
  });

  const handleOpenReturn = (inv: SaleInvoice, item: SaleInvoiceItem) => {
    const lineState = calculateReturnableLineState(item.quantity, item.returnedQuantity || 0);
    setReturnError(null);
    setReturnItem({
      invoiceId: inv.id,
      invoiceItemId: item.id,
      productId: item.productId,
      productName: item.productName,
      soldQty: lineState.soldQuantity,
      alreadyReturnedQty: lineState.returnedQuantity,
      remainingQty: lineState.remainingReturnableQuantity,
      unitPrice: item.unitPrice,
      quantityInput: lineState.remainingReturnableQuantity >= 1 ? '1' : String(lineState.remainingReturnableQuantity),
      isSellable: true,
      reason: 'طلب العميل إرجاع الصنف',
      refundMethod: inv.remainingAmount > 0 && inv.customerId ? 'credit' : 'cash',
    });
    setIsReturnModalOpen(true);
  };

  const parsedReturnQty = returnItem ? parseFloat(returnItem.quantityInput) || 0 : 0;
  const liveReturnValidation = returnItem
    ? validateSaleReturnRequest({
        soldQuantity: returnItem.soldQty,
        alreadyReturnedQuantity: returnItem.alreadyReturnedQty,
        requestedQuantity: parsedReturnQty,
      })
    : { valid: false, error: '' };

  const handleConfirmReturn = async () => {
    if (!returnItem || returnLockRef.current) return;
    setReturnError(null);

    const check = validateSaleReturnRequest({
      soldQuantity: returnItem.soldQty,
      alreadyReturnedQuantity: returnItem.alreadyReturnedQty,
      requestedQuantity: parsedReturnQty,
    });
    if (!check.valid) {
      setReturnError(check.error || 'الكمية غير صالحة');
      return;
    }

    returnLockRef.current = true;
    const refundAmount = Number((parsedReturnQty * returnItem.unitPrice).toFixed(2));
    setReturnSaveState('saving');
    const res = await createSaleReturn({
      invoiceId: returnItem.invoiceId,
      invoiceItemId: returnItem.invoiceItemId,
      productId: returnItem.productId,
      quantity: parsedReturnQty,
      refundAmount,
      refundMethod: returnItem.refundMethod,
      isSellable: returnItem.isSellable,
      reason: returnItem.reason,
    });

    if (!res.ok) {
      setReturnSaveState('idle');
      returnLockRef.current = false;
      setReturnError(res.error || 'تعذر تنفيذ المرتجع، يرجى المحاولة مرة أخرى');
      return;
    }

    setReturnSaveState('saved');
    setReturnSuccess(`تم تسجيل مرتجع ${parsedReturnQty} من "${returnItem.productName}" بقيمة ${formatCurrency(refundAmount)} بنجاح.`);
    setTimeout(() => {
      setReturnSaveState('idle');
      returnLockRef.current = false;
      setIsReturnModalOpen(false);
      setReturnItem(null);
    }, 450);
  };

  const selectedInvoiceReturns = selectedInvoice
    ? salesReturns.filter((r) => r.invoiceId === selectedInvoice.id)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <ScrollText strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>سجل فواتير المبيعات والمرتجع</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا {ownerName} - متابعة كاملة للفواتير، الكميات المرتجعة والمتبقية، وسجل المرتجعات
          </p>
        </div>

        <Link href="/sales/new">
          <Button variant="primary" size="md">
            <Plus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1" />
            <span>فاتورة جديدة (POS)</span>
          </Button>
        </Link>
      </div>

      {returnSuccess && (
        <div className="p-3.5 bg-success-bg border border-success-border rounded-2xl text-success text-xs font-bold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-success shrink-0" />
            <span>{returnSuccess}</span>
          </span>
          <button type="button" onClick={() => setReturnSuccess(null)} className="text-success hover:underline">
            إخفاء
          </button>
        </div>
      )}

      <div className="relative">
        <Search strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-ink-muted absolute right-3.5 top-3" />
        <input
          type="text"
          placeholder="ابحث برقم الفاتورة أو اسم العميل..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pr-11 pl-4 rounded-xl border border-line bg-surface text-ink-strong placeholder:text-ink-muted text-sm focus:border-flame focus:outline-none focus:ring-2 focus:ring-flame/25"
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isInitialLoading ? (
            <TableSkeletonRows columns={8} rows={6} />
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-ink-muted text-sm">
              لا توجد فواتير مبيعات مطابقة للبحث.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                <tr>
                  <th className="p-3 sm:p-4">رقم الفاتورة</th>
                  <th className="p-3 sm:p-4">العميل</th>
                  <th className="p-3 sm:p-4">الحالة</th>
                  <th className="p-3 sm:p-4">طريقة الدفع</th>
                  <th className="p-3 sm:p-4">الإجمالي</th>
                  {can('finance.view_cost_profit') && <th className="p-3 sm:p-4">مجمل الربح</th>}
                  <th className="p-3 sm:p-4">المتبقي (دين)</th>
                  <th className="p-3 sm:p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-alt/60 transition-colors">
                    <td className="p-3 sm:p-4 font-mono font-bold text-truffle dark:text-flame">
                      {inv.invoiceNumber}
                      <p className="text-[10px] text-ink-muted font-normal">
                        {formatArabicDateTime(inv.createdAt)}
                        {inv.createdByName ? ` • ${inv.createdByName}` : ''}
                      </p>
                    </td>
                    <td className="p-3 sm:p-4 font-bold text-ink-strong">{inv.customerName}</td>
                    <td className="p-3 sm:p-4">{getInvoiceStatusBadge(inv.status)}</td>
                    <td className="p-3 sm:p-4">
                      <Badge
                        variant={
                          inv.paymentMethod === 'cash'
                            ? 'success'
                            : inv.paymentMethod === 'wallet'
                            ? 'accent'
                            : inv.paymentMethod === 'instapay'
                            ? 'info'
                            : 'danger'
                        }
                      >
                        {inv.paymentMethod === 'cash'
                          ? 'كاش'
                          : inv.paymentMethod === 'wallet'
                          ? 'محفظة'
                          : inv.paymentMethod === 'instapay'
                          ? 'إنستاباي'
                          : 'آجل'}
                      </Badge>
                    </td>
                    <td className="p-3 sm:p-4 font-black text-ink-strong">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    {can('finance.view_cost_profit') && (
                      <td className="p-3 sm:p-4 font-black text-success">
                        {formatCurrency(inv.grossProfit)}
                      </td>
                    )}
                    <td className="p-3 sm:p-4 font-bold">
                      {inv.remainingAmount > 0 ? (
                        <span className="text-danger-text">{formatCurrency(inv.remainingAmount)}</span>
                      ) : (
                        <span className="text-success">خالص</span>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPrintInvoice(inv)}
                          title="طباعة إيصال الفاتورة"
                        >
                          <Printer strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className="text-xs text-truffle dark:text-flame font-bold"
                        >
                          التفاصيل والمرتجع
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* نافذة تفاصيل الفاتورة وبنودها وسجل المرتجعات */}
      {selectedInvoice && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectedInvoiceId(null)}
          title={`تفاصيل فاتورة بيع ${selectedInvoice.invoiceNumber}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-surface-alt border border-line p-3.5 rounded-xl text-xs">
              <div>
                <span className="text-ink-muted block">الحالة:</span>
                <div className="mt-1">{getInvoiceStatusBadge(selectedInvoice.status)}</div>
              </div>
              <div>
                <span className="text-ink-muted block">العميل:</span>
                <p className="font-bold text-ink-strong mt-0.5">{selectedInvoice.customerName}</p>
              </div>
              <div>
                <span className="text-ink-muted block">الإجمالي:</span>
                <p className="font-bold text-truffle dark:text-flame mt-0.5">{formatCurrency(selectedInvoice.totalAmount)}</p>
              </div>
              <div>
                <span className="text-ink-muted block">المتبقي (آجل):</span>
                <p className={`font-bold mt-0.5 ${selectedInvoice.remainingAmount > 0 ? 'text-danger-text' : 'text-success'}`}>
                  {selectedInvoice.remainingAmount > 0 ? formatCurrency(selectedInvoice.remainingAmount) : 'خالص'}
                </p>
              </div>
              <div>
                <span className="text-ink-muted block">التاريخ:</span>
                <p className="font-medium text-ink mt-0.5">{formatArabicDateTime(selectedInvoice.createdAt)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-ink mb-2">بنود الفاتورة وحالة الإرجاع:</h4>
              <div className="border border-line rounded-xl overflow-hidden divide-y divide-divider">
                {selectedInvoice.items.map((item) => {
                  const lineState = calculateReturnableLineState(item.quantity, item.returnedQuantity || 0);
                  return (
                    <div key={item.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface">
                      <div>
                        <p className="text-xs font-bold text-ink-strong">{item.productName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-surface-alt border border-line text-ink font-bold">
                            المباع: {lineState.soldQuantity}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-warning-bg text-warning font-bold">
                            المرتجع حتى الآن: {lineState.returnedQuantity}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              lineState.isFullyReturned
                                ? 'bg-danger-bg text-danger-text'
                                : 'bg-success-bg text-success'
                            }`}
                          >
                            المتبقي للإرجاع: {lineState.remainingReturnableQuantity}
                          </span>
                          <span className="text-ink-muted">
                            × {formatCurrency(item.unitPrice)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <span className="text-xs font-black text-ink-strong">{formatCurrency(item.lineTotal)}</span>
                        {lineState.isFullyReturned ? (
                          <Badge variant="danger" className="text-[10px]">
                            تم إرجاع الكمية بالكامل
                          </Badge>
                        ) : can('sales.process_return') ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReturn(selectedInvoice, item)}
                            className="text-xs text-danger-text border-danger-border hover:bg-danger-bg"
                          >
                            <RotateCcw strokeWidth={ICON_TOKENS.strokeWidth} className="w-3 h-3 ml-1" />
                            <span>إرجاع</span>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-ink mb-2 flex items-center gap-1.5">
                <History strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-danger-text" />
                <span>سجل المرتجعات على هذه الفاتورة ({selectedInvoiceReturns.length})</span>
              </h4>
              {selectedInvoiceReturns.length === 0 ? (
                <div className="p-4 rounded-xl bg-surface-alt border border-line text-center text-xs text-ink-muted">
                  لم تتم أي عمليات مرتجع على هذه الفاتورة حتى الآن.
                </div>
              ) : (
                <div className="border border-danger-border rounded-xl overflow-hidden divide-y divide-danger-border/50 bg-danger-bg/35">
                  {selectedInvoiceReturns.map((ret) => (
                    <div key={ret.id} className="p-3 text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-ink-strong">
                          {ret.items.map((ri) => `${ri.productName} (${ri.quantity} قطعة - ${ri.condition === 'sellable' ? 'سليم' : 'تالف'})`).join('، ')}
                        </span>
                        <span className="font-mono font-black text-danger-text">
                          استرداد: {formatCurrency(ret.refundAmount)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
                        <span>
                          التاريخ: {formatArabicDateTime(ret.createdAt)} | بواسطة: <strong className="text-ink-strong">{ret.createdByName || ownerName}</strong>
                        </span>
                        <span>
                          الطريقة:{' '}
                          {ret.refundMethod === 'cash'
                            ? 'كاش من الدرج'
                            : ret.refundMethod === 'wallet'
                            ? 'محفظة'
                            : ret.refundMethod === 'instapay'
                            ? 'إنستاباي'
                            : 'خصم من دين العميل'}
                        </span>
                      </div>
                      {ret.reason && (
                        <p className="text-[11px] text-ink">السبب: {ret.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* نافذة تسجيل المرتجع */}
      {isReturnModalOpen && returnItem && (
        <Dialog
          isOpen={true}
          onClose={() => setIsReturnModalOpen(false)}
          title={`تسجيل مرتجع للصنف: ${returnItem.productName}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-info-bg border border-info-border rounded-xl text-xs text-ink-strong space-y-1">
              <p>المباع بالفاتورة: <strong>{returnItem.soldQty}</strong> | المرتجع سابقاً: <strong>{returnItem.alreadyReturnedQty}</strong> | المتبقي للإرجاع: <strong className="text-success">{returnItem.remainingQty}</strong></p>
              <p className="text-[11px] text-ink-muted">المرتجع السليم يعود للمخزون فوراً، والتالف يسجل كخسارة ولا يرفع المخزون المتاح للبيع.</p>
            </div>

            {returnError && (
              <div className="p-3 bg-danger-bg border border-danger-border rounded-xl text-xs text-danger-text font-bold flex items-center gap-2">
                <AlertCircle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-danger-text shrink-0" />
                <span>{returnError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-ink block mb-1">الكمية المرتجعة</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={returnItem.quantityInput}
                onChange={(e) => {
                  setReturnError(null);
                  setReturnItem({ ...returnItem, quantityInput: e.target.value });
                }}
                className="w-full h-10 px-3 text-sm border border-line bg-surface text-ink-strong rounded-xl font-bold focus:outline-none focus:border-flame"
              />
              {!liveReturnValidation.valid && returnItem.quantityInput !== '' && (
                <p className="text-[11px] text-danger-text font-bold mt-1">
                  {liveReturnValidation.error}
                </p>
              )}
              <p className="text-[11px] text-ink-muted mt-1">
                الحد الأقصى المتاح للإرجاع الآن: {returnItem.remainingQty} قطعة
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">حالة البضاعة المرتجعة</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReturnItem({ ...returnItem, isSellable: true })}
                  className={`p-3 rounded-xl border text-xs font-bold transition-colors ${
                    returnItem.isSellable
                      ? 'bg-success text-success-ink border-success'
                      : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
                  }`}
                >
                  بضاعة سليمة (تعود للمخزون)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnItem({ ...returnItem, isSellable: false })}
                  className={`p-3 rounded-xl border text-xs font-bold transition-colors ${
                    !returnItem.isSellable
                      ? 'bg-truffle text-truffle-ink border-truffle'
                      : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
                  }`}
                >
                  تالف / هالك (خسارة مخزنية)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">طريقة رد المبلغ</label>
              <select
                value={returnItem.refundMethod}
                onChange={(e: any) => setReturnItem({ ...returnItem, refundMethod: e.target.value })}
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
              >
                <option value="cash">نقدًا من الدرج (كاش)</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="instapay">إنستاباي</option>
                <option value="credit">خصم من رصيد دين العميل</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">سبب الإرجاع</label>
              <input
                type="text"
                value={returnItem.reason}
                onChange={(e) => setReturnItem({ ...returnItem, reason: e.target.value })}
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
              />
            </div>

            <div className="bg-surface-alt border border-line p-3 rounded-xl flex justify-between text-xs font-bold text-ink-strong">
              <span>إجمالي المبلغ المسترد:</span>
              <span className="text-danger-text">
                {formatCurrency(Math.max(0, parsedReturnQty * returnItem.unitPrice))}
              </span>
            </div>

            <Button
              size="lg"
              variant="danger"
              saveState={returnSaveState}
              savedText="تم تسجيل المرتجع"
              disabled={!liveReturnValidation.valid}
              onClick={handleConfirmReturn}
              className="w-full font-bold"
            >
              تأكيد وحفظ المرتجع
            </Button>
          </div>
        </Dialog>
      )}

      {printInvoice && (
        <InvoicePrintView
          invoice={printInvoice}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </div>
  );
}
