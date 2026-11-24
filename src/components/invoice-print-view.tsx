'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';
import { SaleInvoice } from '@/lib/store/shop-store';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';

interface InvoicePrintViewProps {
  invoice: SaleInvoice;
  onClose: () => void;
}

export function InvoicePrintView({ invoice, onClose }: InvoicePrintViewProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        {/* أزرار التحكم العلوية (لا تظهر عند الطباعة) */}
        <div className="flex items-center justify-between no-print border-b pb-3">
          <Button variant="primary" size="md" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            <span>طباعة الإيصال (Ctrl+P)</span>
          </Button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* تصميم الإيصال الحراري 80mm */}
        <div className="font-mono text-slate-900 text-xs space-y-3 p-2 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
          <div className="text-center space-y-1 border-b border-dashed pb-2">
            <h2 className="text-base font-black">محل شفرة</h2>
            <p className="text-[11px] text-slate-600">إدارة التجزئة - المالك: كريم</p>
            <p className="text-[10px] text-slate-500">{formatArabicDateTime(invoice.createdAt)}</p>
            <p className="font-bold text-[11px]">رقم الفاتورة: {invoice.invoiceNumber}</p>
          </div>

          <div className="flex justify-between text-[11px] font-semibold border-b border-dashed pb-1">
            <span>العميل: {invoice.customerName}</span>
            <span>طريقة الدفع: {invoice.paymentMethod === 'cash' ? 'كاش' : invoice.paymentMethod === 'wallet' ? 'محفظة' : invoice.paymentMethod === 'instapay' ? 'إنستاباي' : 'آجل'}</span>
          </div>

          {/* جدول البنود */}
          <table className="w-full text-right text-[11px]">
            <thead>
              <tr className="border-b border-dashed text-slate-600">
                <th className="py-1">الصنف</th>
                <th className="text-center py-1">الكمية</th>
                <th className="text-center py-1">السعر</th>
                <th className="text-left py-1">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-slate-200">
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="py-1">
                  <td className="py-1 max-w-[120px] truncate">{item.productName}</td>
                  <td className="text-center py-1">{item.quantity}</td>
                  <td className="text-center py-1">{item.unitPrice}</td>
                  <td className="text-left py-1 font-bold">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* الحسابات الإجمالية */}
          <div className="border-t border-dashed pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>المجموع الفرعي:</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>الخصم:</span>
                <span>-{formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black border-t border-b border-slate-900 py-1">
              <span>الإجمالي المطلوب:</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-700">
              <span>المدفوع:</span>
              <span>{formatCurrency(invoice.paidAmount)}</span>
            </div>
            {invoice.remainingAmount > 0 && (
              <div className="flex justify-between font-bold text-rose-600">
                <span>المتبقي (آجل على العميل):</span>
                <span>{formatCurrency(invoice.remainingAmount)}</span>
              </div>
            )}
          </div>

          <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed">
            <p>شكرًا لتعاملكم مع محل شفرة!</p>
            <p>البضاعة المباعة ترد وتستبدل خلال 14 يومًا بالفاتورة</p>
          </div>
        </div>
      </div>
    </div>
  );
}
