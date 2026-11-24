'use client';

import React, { useState } from 'react';
import { Printer, X, Tag, Settings2, Plus, Minus, Check } from 'lucide-react';
import { Product } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { generateBarcodeSvg } from '@/lib/barcode-generator';
import { formatCurrency } from '@/lib/formatters';

interface BarcodeLabelPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export function BarcodeLabelPrinterModal({
  isOpen,
  onClose,
  products,
}: BarcodeLabelPrinterModalProps) {
  // عدد النسخ لكل منتج
  const [copies, setCopies] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    products.forEach((p) => {
      init[p.id] = 1;
    });
    return init;
  });

  const [labelSize, setLabelSize] = useState<'38x25' | '50x30' | 'a4-sheet'>('38x25');
  const [showPrice, setShowPrice] = useState(true);
  const [showShopName, setShowShopName] = useState(true);

  if (!isOpen || products.length === 0) return null;

  const updateCopies = (productId: string, delta: number) => {
    setCopies((prev) => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta),
    }));
  };

  const setAllCopies = (num: number) => {
    const updated: Record<string, number> = {};
    products.forEach((p) => {
      updated[p.id] = Math.max(1, num);
    });
    setCopies(updated);
  };

  // تجهيز قائمة الملصقات الفردية
  const labelItems: Product[] = [];
  products.forEach((p) => {
    const count = copies[p.id] || 1;
    for (let i = 0; i < count; i++) {
      labelItems.push(p);
    }
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="طباعة ملصقات الباركود والأسعار (Stickers)"
      description="اختر عدد النسخ ومقاس الملصق ثم اضغط طباعة"
      maxWidth="2xl"
    >
      <div className="p-4 sm:p-6 space-y-5">
        {/* شريط التحكم السريع */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">مقاس ورق الملصقات:</label>
            <select
              value={labelSize}
              onChange={(e: any) => setLabelSize(e.target.value)}
              className="w-full h-9 px-2 rounded-lg border border-slate-300 bg-white font-bold"
            >
              <option value="38x25">ملصق حراري صغير (38 مم × 25 مم)</option>
              <option value="50x30">ملصق حراري قياسي (50 مم × 30 مم)</option>
              <option value="a4-sheet">ورق A4 مقسم ملصقات (24 ملصق بالورقة)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">البيانات الظاهرة بالملصق:</label>
            <div className="flex items-center gap-3 mt-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>سعر البيع</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showShopName}
                  onChange={(e) => setShowShopName(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>اسم المحل</span>
              </label>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">تحديد نسخ الكل:</label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAllCopies(n)}
                  className="px-2.5 py-1 rounded bg-white border hover:bg-slate-100 font-mono font-bold"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* قائمة المنتجات وعدد النسخ لكل منها */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b sticky top-0">
              <tr>
                <th className="p-2.5">اسم المنتج</th>
                <th className="p-2.5 text-center">الباركود</th>
                <th className="p-2.5 text-center">السعر</th>
                <th className="p-2.5 text-center">عدد الملصقات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="p-2.5 font-bold text-slate-900 truncate max-w-[200px]">{p.name}</td>
                  <td className="p-2.5 text-center font-mono text-slate-600">{p.barcode || 'غير محدد'}</td>
                  <td className="p-2.5 text-center font-bold text-brand-700">{formatCurrency(p.salePrice)}</td>
                  <td className="p-2.5 text-center">
                    <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateCopies(p.id, -1)}
                        className="w-5 h-5 bg-white rounded flex items-center justify-center font-bold text-slate-700 hover:bg-slate-200"
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-bold font-mono">{copies[p.id] || 1}</span>
                      <button
                        type="button"
                        onClick={() => updateCopies(p.id, 1)}
                        className="w-5 h-5 bg-white rounded flex items-center justify-center font-bold text-slate-700 hover:bg-slate-200"
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* معاينة الملصقات قبل الطباعة */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-700">
              معاينة ملصقات الباركود ({labelItems.length} ملصق):
            </h4>
            <span className="text-[11px] text-slate-400">
              جاهز للطباعة على طابعات الباركود الحرارية (Xprinter / Zebra) أو ورق A4
            </span>
          </div>

          <div
            id="printable-barcode-labels"
            className="p-4 bg-slate-100 rounded-2xl border border-slate-300 max-h-72 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5"
          >
            {labelItems.map((prod, idx) => {
              const barcode = prod.barcode || '622100000000';
              const svgString = generateBarcodeSvg(barcode, {
                height: 38,
                barWidth: 1.4,
                showText: true,
                fontSize: 10,
              });

              return (
                <div
                  key={`${prod.id}-${idx}`}
                  className="bg-white p-2 rounded-lg border border-slate-300 shadow-sm flex flex-col items-center justify-between text-center select-none aspect-[1.5/1]"
                >
                  {showShopName && (
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                      محل شفرة
                    </span>
                  )}
                  <p className="text-[10px] font-bold text-slate-900 leading-tight line-clamp-1 w-full mt-0.5">
                    {prod.name}
                  </p>
                  <div
                    className="w-full my-1 flex justify-center max-h-12"
                    dangerouslySetInnerHTML={{ __html: svgString }}
                  />
                  {showPrice && (
                    <span className="text-[11px] font-black text-slate-900 font-mono">
                      {formatCurrency(prod.salePrice)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* أزرار الإجراء */}
        <div className="flex items-center justify-between pt-3 border-t">
          <Button variant="ghost" size="md" onClick={onClose}>
            إلغاء
          </Button>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handlePrint}
            className="gap-2 font-bold shadow-md shadow-brand-500/20"
          >
            <Printer className="w-5 h-5" />
            <span>طباعة الملصقات ({labelItems.length} ملصق)</span>
          </Button>
        </div>
      </div>

      {/* تنسيقات الطباعة الخفية والمخصصة للطابعات الحرارية والورق */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-barcode-labels,
          #printable-barcode-labels * {
            visibility: visible;
          }
          #printable-barcode-labels {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 4mm !important;
          }
          #printable-barcode-labels > div {
            page-break-inside: avoid;
            border: 1px dashed #ccc !important;
            width: 48mm !important;
            height: 28mm !important;
            padding: 1.5mm !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </Dialog>
  );
}
