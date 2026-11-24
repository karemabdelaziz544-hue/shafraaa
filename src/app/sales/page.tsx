'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Plus,
  Search,
  RotateCcw,
  Printer,
  ChevronLeft,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useShop, SaleInvoice } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { InvoicePrintView } from '@/components/invoice-print-view';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';

export default function SalesHistoryPage() {
  const { salesInvoices, products, createSaleReturn } = useShop();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<SaleInvoice | null>(null);

  // حالة نافذة المرتجع
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnItem, setReturnItem] = useState<{
    invoiceId: string;
    productId: string;
    productName: string;
    maxQty: number;
    unitPrice: number;
    quantity: number;
    isSellable: boolean;
    reason: string;
    refundMethod: 'cash' | 'wallet' | 'instapay' | 'credit';
  } | null>(null);

  const filteredInvoices = salesInvoices.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.paymentMethod.toLowerCase().includes(q)
    );
  });

  const handleOpenReturn = (inv: SaleInvoice, item: any) => {
    setReturnItem({
      invoiceId: inv.id,
      productId: item.productId,
      productName: item.productName,
      maxQty: item.quantity,
      unitPrice: item.unitPrice,
      quantity: 1,
      isSellable: true,
      reason: 'طلب العميل إرجاع الصنف',
      refundMethod: 'cash',
    });
    setIsReturnModalOpen(true);
  };

  const handleConfirmReturn = () => {
    if (!returnItem) return;
    const refundAmount = Number((returnItem.quantity * returnItem.unitPrice).toFixed(2));

    createSaleReturn({
      invoiceId: returnItem.invoiceId,
      productId: returnItem.productId,
      quantity: returnItem.quantity,
      refundAmount,
      refundMethod: returnItem.refundMethod,
      isSellable: returnItem.isSellable,
      reason: returnItem.reason,
    });

    setIsReturnModalOpen(false);
    setReturnItem(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-brand-600" />
            <span>سجل فواتير المبيعات والمرتجع</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - فواتيرك محفوظة بالكامل مع التكلفة التاريخية لضمان ثبات الأرباح
          </p>
        </div>

        <Link href="/sales/new">
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4 ml-1" />
            <span>فاتورة جديدة (POS)</span>
          </Button>
        </Link>
      </div>

      {/* شريط البحث والتصفية */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3" />
        <input
          type="text"
          placeholder="ابحث برقم الفاتورة أو اسم العميل..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pr-11 pl-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      {/* قائمة الفواتير */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              لا توجد فواتير مبيعات مطابقة للبحث.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 sm:p-4">رقم الفاتورة</th>
                  <th className="p-3 sm:p-4">العميل</th>
                  <th className="p-3 sm:p-4">طريقة الدفع</th>
                  <th className="p-3 sm:p-4">الأصناف</th>
                  <th className="p-3 sm:p-4">الإجمالي</th>
                  <th className="p-3 sm:p-4">مجمل الربح</th>
                  <th className="p-3 sm:p-4">المتبقي (دين)</th>
                  <th className="p-3 sm:p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sm:p-4 font-mono font-bold text-brand-700">
                      {inv.invoiceNumber}
                      <p className="text-[10px] text-slate-400 font-normal">
                        {formatArabicDateTime(inv.createdAt)}
                      </p>
                    </td>
                    <td className="p-3 sm:p-4 font-bold text-slate-800">{inv.customerName}</td>
                    <td className="p-3 sm:p-4">
                      <Badge
                        variant={
                          inv.paymentMethod === 'cash'
                            ? 'success'
                            : inv.paymentMethod === 'wallet'
                            ? 'warning'
                            : inv.paymentMethod === 'instapay'
                            ? 'purple'
                            : 'info'
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
                    <td className="p-3 sm:p-4 font-medium text-slate-600">
                      {inv.items.length} أصناف
                    </td>
                    <td className="p-3 sm:p-4 font-black text-slate-900">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="p-3 sm:p-4 font-black text-emerald-600">
                      {formatCurrency(inv.grossProfit)}
                    </td>
                    <td className="p-3 sm:p-4 font-bold">
                      {inv.remainingAmount > 0 ? (
                        <span className="text-rose-600">{formatCurrency(inv.remainingAmount)}</span>
                      ) : (
                        <span className="text-emerald-600">خالص</span>
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
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedInvoice(inv)}
                          className="text-xs text-brand-600"
                        >
                          التفاصيل
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

      {/* نافذة تفاصيل الفاتورة وبنودها */}
      {selectedInvoice && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectedInvoice(null)}
          title={`تفاصيل فاتورة بيع ${selectedInvoice.invoiceNumber}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl text-xs">
              <div>
                <span className="text-slate-500">العميل:</span>
                <p className="font-bold">{selectedInvoice.customerName}</p>
              </div>
              <div>
                <span className="text-slate-500">الإجمالي:</span>
                <p className="font-bold text-brand-700">{formatCurrency(selectedInvoice.totalAmount)}</p>
              </div>
              <div>
                <span className="text-slate-500">مجمل الربح:</span>
                <p className="font-bold text-emerald-600">{formatCurrency(selectedInvoice.grossProfit)}</p>
              </div>
              <div>
                <span className="text-slate-500">التاريخ:</span>
                <p className="font-medium">{formatArabicDateTime(selectedInvoice.createdAt)}</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              <h4 className="text-xs font-bold text-slate-700 pb-2">بنود الفاتورة:</h4>
              {selectedInvoice.items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.productName}</p>
                    <p className="text-[11px] text-slate-500">
                      الكمية: {item.quantity} × {item.unitPrice} ج.م (التكلفة التاريخية: {item.unitCost} ج.م)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">{formatCurrency(item.lineTotal)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenReturn(selectedInvoice, item)}
                      className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      <RotateCcw className="w-3 h-3 ml-1" />
                      <span>إرجاع</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Dialog>
      )}

      {/* نافذة تسجيل المرتجع وتحديد الحالة (سليم أو تالف) */}
      {isReturnModalOpen && returnItem && (
        <Dialog
          isOpen={true}
          onClose={() => setIsReturnModalOpen(false)}
          title={`تسجيل مرتجع للصنف: ${returnItem.productName}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
              أهلًا يا كريم: المرتجع السليم يعود للمخزون فورًا. المرتجع التالف يسجل كخسارة ولا يرفع رصيد المخزن المتاح للبيع.
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">الكمية المرتجعة</label>
              <input
                type="number"
                min="1"
                max={returnItem.maxQty}
                value={returnItem.quantity}
                onChange={(e) =>
                  setReturnItem({ ...returnItem, quantity: Math.min(returnItem.maxQty, Math.max(1, parseInt(e.target.value) || 1)) })
                }
                className="w-full h-10 px-3 text-sm border rounded-xl"
              />
              <p className="text-[11px] text-slate-400 mt-1">الحد الأقصى بالفاتورة: {returnItem.maxQty} قطعة</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">حالة البضاعة المرتجعة</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReturnItem({ ...returnItem, isSellable: true })}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                    returnItem.isSellable
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  بضاعة سليمة (تعود للمخزون)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnItem({ ...returnItem, isSellable: false })}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                    !returnItem.isSellable
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  تالف / هالك (خسارة مخزنية)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">طريقة رد المبلغ</label>
              <select
                value={returnItem.refundMethod}
                onChange={(e: any) => setReturnItem({ ...returnItem, refundMethod: e.target.value })}
                className="w-full h-10 px-3 text-xs border rounded-xl"
              >
                <option value="cash">نقدًا من الدرج (كاش)</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="instapay">إنستاباي</option>
                <option value="credit">خصم من رصيد دين العميل</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">سبب الإرجاع</label>
              <input
                type="text"
                value={returnItem.reason}
                onChange={(e) => setReturnItem({ ...returnItem, reason: e.target.value })}
                className="w-full h-10 px-3 text-xs border rounded-xl"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-xl flex justify-between text-xs font-bold">
              <span>إجمالي المبلغ المسترد:</span>
              <span className="text-rose-600">
                {formatCurrency(returnItem.quantity * returnItem.unitPrice)}
              </span>
            </div>

            <Button
              size="lg"
              variant="danger"
              onClick={handleConfirmReturn}
              className="w-full font-bold"
            >
              تأكيد المرتجع
            </Button>
          </div>
        </Dialog>
      )}

      {/* نافذة الطباعة */}
      {printInvoice && (
        <InvoicePrintView
          invoice={printInvoice}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </div>
  );
}
