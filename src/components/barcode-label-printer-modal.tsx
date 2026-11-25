'use client';

import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Product, useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { generateBarcodeSvg } from '@/lib/barcode-generator';
import { formatCurrency } from '@/lib/formatters';
import { ICON_TOKENS, PALETTE } from '@/lib/design-tokens';

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
  const { shopName } = useShop();
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [labelSize, setLabelSize] = useState<'38x25' | '50x30' | 'a4-sheet'>('38x25');
  const [showPrice, setShowPrice] = useState(true);
  const [showShopName, setShowShopName] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setCopies((prev) => {
      const next: Record<string, number> = {};
      products.forEach((p) => {
        next[p.id] = prev[p.id] || 1;
      });
      return next;
    });
  }, [isOpen, products]);

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

  // الطباعة المباشرة من نفس النافذة دون فتح تبويب about:blank
  const handlePrint = () => {
    window.print();
  };

  const labelDims =
    labelSize === '38x25'
      ? { w: '38mm', h: '25mm' }
      : labelSize === '50x30'
      ? { w: '50mm', h: '30mm' }
      : { w: '64mm', h: '34mm' };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="طباعة ملصقات الباركود والأسعار (Stickers)"
      description="اختر عدد النسخ ومقاس الملصق ثم اضغط طباعة مباشرة من هذه النافذة"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* شريط التحكم السريع */}
        <div className="bg-surface-alt p-4 rounded-2xl border border-line grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs no-print">
          <div>
            <label className="font-bold text-ink block mb-1">مقاس ورق الملصقات:</label>
            <select
              value={labelSize}
              onChange={(e: any) => setLabelSize(e.target.value)}
              className="w-full h-9 px-2 rounded-lg border border-line bg-surface text-ink-strong font-bold focus:outline-none focus:border-flame"
            >
              <option value="38x25">ملصق حراري صغير (38 مم × 25 مم)</option>
              <option value="50x30">ملصق حراري قياسي (50 مم × 30 مم)</option>
              <option value="a4-sheet">ورق A4 مقسم ملصقات (24 ملصق بالورقة)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-ink block mb-1">البيانات الظاهرة بالملصق:</label>
            <div className="flex items-center gap-3 mt-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-ink">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded accent-truffle focus:ring-flame"
                />
                <span>سعر البيع</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-ink">
                <input
                  type="checkbox"
                  checked={showShopName}
                  onChange={(e) => setShowShopName(e.target.checked)}
                  className="rounded accent-truffle focus:ring-flame"
                />
                <span>اسم المحل</span>
              </label>
            </div>
          </div>

          <div>
            <label className="font-bold text-ink block mb-1">تحديد نسخ الكل:</label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAllCopies(n)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-line text-ink-strong hover:bg-flame hover:text-abyssal hover:border-flame font-mono font-bold transition-colors"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* قائمة المنتجات وعدد النسخ لكل منها */}
        <div className="border border-line rounded-xl overflow-hidden max-h-44 overflow-y-auto no-print">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-alt text-ink font-bold border-b border-line sticky top-0">
              <tr>
                <th className="p-2.5">اسم المنتج</th>
                <th className="p-2.5 text-center">الباركود</th>
                <th className="p-2.5 text-center">السعر</th>
                <th className="p-2.5 text-center">عدد الملصقات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider bg-surface">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="p-2.5 font-bold text-ink-strong truncate max-w-[200px]">{p.name}</td>
                  <td className="p-2.5 text-center font-mono text-ink-muted">{p.barcode || 'غير محدد'}</td>
                  <td className="p-2.5 text-center font-bold text-truffle dark:text-flame">{formatCurrency(p.salePrice)}</td>
                  <td className="p-2.5 text-center">
                    <div className="inline-flex items-center gap-1 bg-surface-alt border border-line p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateCopies(p.id, -1)}
                        className="w-5 h-5 bg-surface rounded flex items-center justify-center font-bold text-ink-strong hover:bg-oatmeal/50"
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-bold font-mono text-ink-strong">{copies[p.id] || 1}</span>
                      <button
                        type="button"
                        onClick={() => updateCopies(p.id, 1)}
                        className="w-5 h-5 bg-surface rounded flex items-center justify-center font-bold text-ink-strong hover:bg-oatmeal/50"
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
          <div className="flex items-center justify-between mb-2 no-print">
            <h4 className="text-xs font-bold text-ink">
              معاينة ملصقات الباركود ({labelItems.length} ملصق):
            </h4>
            <span className="text-[11px] text-ink-muted">
              جاهز للطباعة المباشرة على الطابعات الحرارية أو ورق A4
            </span>
          </div>

          <div
            id="printable-barcode-labels"
            className="p-4 bg-oatmeal/35 rounded-2xl border border-line max-h-72 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5"
          >
            {labelItems.map((prod, idx) => {
              const barcode = prod.barcode || '622100000000';
              const svgString = generateBarcodeSvg(barcode, {
                height: 36,
                barWidth: 1.35,
                showText: true,
                fontSize: 10,
                color: PALETTE.abyssal,
              });

              return (
                <div
                  key={`${prod.id}-${idx}`}
                  className="sticker-item bg-palladian p-2 rounded-lg border border-line shadow-card flex flex-col items-center justify-between text-center select-none aspect-[1.5/1]"
                >
                  {showShopName && (
                    <span className="text-[9px] font-black text-fantastic uppercase tracking-wider block truncate w-full">
                      {shopName}
                    </span>
                  )}
                  <p className="text-[10px] font-bold text-abyssal leading-tight line-clamp-1 w-full mt-0.5">
                    {prod.name}
                  </p>
                  <div
                    className="w-full my-0.5 flex justify-center max-h-12 text-abyssal"
                    dangerouslySetInnerHTML={{ __html: svgString }}
                  />
                  {showPrice && (
                    <span className="text-[11px] font-black text-abyssal font-mono">
                      {formatCurrency(prod.salePrice)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* أزرار الإجراء */}
        <div className="flex items-center justify-between pt-3 border-t border-divider no-print">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            إلغاء
          </Button>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handlePrint}
            className="gap-2 font-bold shadow-accent"
          >
            <Printer strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
            <span>طباعة الملصقات ({labelItems.length} ملصق)</span>
          </Button>
        </div>
      </div>

      {/* تنسيقات الطباعة المعزولة مباشرة من المودال بدون فتح أي تبويب إضافي */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-barcode-labels,
          #printable-barcode-labels * {
            visibility: visible !important;
          }
          #printable-barcode-labels {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            border: none !important;
            padding: 2mm !important;
            margin: 0 !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 2mm !important;
          }
          #printable-barcode-labels > .sticker-item {
            page-break-inside: avoid;
            break-inside: avoid;
            background: #ffffff !important;
            color: ${PALETTE.abyssal} !important;
            border: 1px dashed ${PALETTE.oatmeal} !important;
            width: ${labelDims.w} !important;
            height: ${labelDims.h} !important;
            padding: 1.5mm !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </Dialog>
  );
}
