'use client';

import React, { useRef, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Package,
  Plus,
  Search,
  Camera,
  Edit,
  Trash2,
  AlertTriangle,
  History,
  TrendingUp,
  Tag,
  Printer,
  Sparkles,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useShop, Product } from '@/lib/store/shop-store';
import { Button, SaveButtonState } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { calculateProfitMargin } from '@/lib/calculations';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { generateUniqueBarcode } from '@/lib/barcode-generator';

const BarcodeScannerModal = dynamic(
  () => import('@/components/barcode-scanner-modal').then((mod) => mod.BarcodeScannerModal),
  { ssr: false }
);

const BarcodeLabelPrinterModal = dynamic(
  () => import('@/components/barcode-label-printer-modal').then((mod) => mod.BarcodeLabelPrinterModal),
  { ssr: false }
);

function ProductsContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');

  const { products, addProduct, updateProduct, deleteProduct, isInitialLoading } = useShop();
  const [productSaveState, setProductSaveState] = useState<SaveButtonState>('idle');
  const saveLockRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLowStockFilter, setIsLowStockFilter] = useState(filterParam === 'low-stock');

  // تحديد المنتجات لطباعة ملصقات الباركود
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isLabelPrinterOpen, setIsLabelPrinterOpen] = useState(false);
  const [productsToPrint, setProductsToPrint] = useState<Product[]>([]);

  // نوافذ
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'form' | 'search'>('form');

  // حقول نموذج الإضافة / التعديل
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: 'إلكترونيات',
    costPrice: 0,
    extraCost: 0,
    salePrice: 0,
    openingStock: 0,
    minStockAlert: 5,
    unit: 'قطعة',
  });

  const categories = Array.from(new Set(products.map((p) => p.category || 'عام')));

  // تصفية المنتجات
  const filteredProducts = products.filter((p) => {
    if (isLowStockFilter && p.currentStock > p.minStockAlert) return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  // حساب الهامش المباشر في النموذج
  const liveMargin = calculateProfitMargin(
    formData.costPrice,
    formData.extraCost,
    formData.salePrice
  );

  // توليد باركود تلقائي فريد
  const handleGenerateNewBarcode = () => {
    const existingCodes = products.map((p) => p.barcode).filter(Boolean);
    const newCode = generateUniqueBarcode(existingCodes);
    setFormData((prev) => ({ ...prev, barcode: newCode }));
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    const existingCodes = products.map((p) => p.barcode).filter(Boolean);
    const autoCode = generateUniqueBarcode(existingCodes);

    setFormData({
      name: '',
      barcode: autoCode,
      category: 'إلكترونيات',
      costPrice: 0,
      extraCost: 0,
      salePrice: 0,
      openingStock: 0,
      minStockAlert: 5,
      unit: 'قطعة',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      costPrice: p.costPrice,
      extraCost: p.extraCost,
      salePrice: p.salePrice,
      openingStock: p.openingStock,
      minStockAlert: p.minStockAlert,
      unit: p.unit,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || saveLockRef.current) return;
    saveLockRef.current = true;
    setProductSaveState('saving');

    const res = editingProduct
      ? await updateProduct(editingProduct.id, {
          name: formData.name,
          barcode: formData.barcode,
          category: formData.category,
          costPrice: formData.costPrice,
          extraCost: formData.extraCost,
          salePrice: formData.salePrice,
          minStockAlert: formData.minStockAlert,
          unit: formData.unit,
        })
      : await addProduct({
          name: formData.name,
          barcode: formData.barcode,
          category: formData.category,
          costPrice: formData.costPrice,
          extraCost: formData.extraCost,
          salePrice: formData.salePrice,
          openingStock: formData.openingStock,
          minStockAlert: formData.minStockAlert,
          unit: formData.unit,
        });

    if (!res.ok) {
      setProductSaveState('idle');
      saveLockRef.current = false;
      return;
    }

    setProductSaveState('saved');
    setTimeout(() => {
      setProductSaveState('idle');
      saveLockRef.current = false;
      setIsAddModalOpen(false);
    }, 550);
  };

  const handleBarcodeScanned = (barcode: string) => {
    if (scannerTarget === 'form') {
      setFormData((prev) => ({ ...prev, barcode }));
    } else {
      setSearchQuery(barcode);
    }
  };

  // إدارة تحديد المنتجات للطباعة
  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  // فتح نافذة طباعة لمنتج واحد
  const handlePrintSingleProduct = (product: Product) => {
    setProductsToPrint([product]);
    setIsLabelPrinterOpen(true);
  };

  // فتح نافذة طباعة للمنتجات المحددة
  const handlePrintBatch = () => {
    const selected = products.filter((p) => selectedProductIds.includes(p.id));
    if (selected.length === 0) return;
    setProductsToPrint(selected);
    setIsLabelPrinterOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-600" />
            <span>المنتجات والتسعير وهامش الربح والباركود</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - إدارة دقيقة للأصناف وتوليد الباركود تلقائيًا وطباعة استيكرات الأسعار
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* زر طباعة الملصقات للمنتجات المحددة */}
          {selectedProductIds.length > 0 && (
            <Button
              variant="outline"
              size="md"
              onClick={handlePrintBatch}
              className="gap-1.5 font-bold border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ملصقات ({selectedProductIds.length})</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setScannerTarget('search');
              setIsScannerOpen(true);
            }}
          >
            <Camera className="w-4 h-4 ml-1" />
            <span>بحث بالكاميرا</span>
          </Button>

          <Button variant="primary" size="md" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 ml-1" />
            <span>إضافة صنف جديد</span>
          </Button>
        </div>
      </div>

      {/* شريط الفلاتر والبحث */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="ابحث باسم الصنف أو الباركود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pr-11 pl-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-11 px-3 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:outline-none"
        >
          <option value="all">جميع الأقسام</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          onClick={() => setIsLowStockFilter(!isLowStockFilter)}
          className={`h-11 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
            isLowStockFilter
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>النواقص فقط</span>
        </button>
      </div>

      {/* جدول المنتجات */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isInitialLoading ? (
            <TableSkeletonRows columns={7} rows={6} />
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              لا توجد منتجات مطابقة لخيارات البحث.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 sm:p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedProductIds.length === filteredProducts.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                      title="تحديد الكل"
                    />
                  </th>
                  <th className="p-3 sm:p-4">الصنف والباركود</th>
                  <th className="p-3 sm:p-4">القسم</th>
                  <th className="p-3 sm:p-4">التكلفة الإجمالية</th>
                  <th className="p-3 sm:p-4">سعر البيع</th>
                  <th className="p-3 sm:p-4">هامش الربح</th>
                  <th className="p-3 sm:p-4">المخزون الحالي</th>
                  <th className="p-3 sm:p-4 text-center">إجراءات وطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isLow = p.currentStock <= p.minStockAlert;
                  const totalCost = p.costPrice + p.extraCost;
                  const margin = calculateProfitMargin(p.costPrice, p.extraCost, p.salePrice);
                  const isSelected = selectedProductIds.includes(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-purple-50/50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="p-3 sm:p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 sm:p-4">
                        <p className="font-bold text-slate-900">{p.name}</p>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {p.barcode || 'بدون باركود'}
                        </p>
                      </td>
                      <td className="p-3 sm:p-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                          {p.category || 'عام'}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-medium text-slate-700">
                        {formatCurrency(totalCost)}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-bold text-brand-700">
                        {formatCurrency(p.salePrice)}
                      </td>
                      <td className="p-3 sm:p-4">
                        <span
                          className={`font-bold font-mono ${
                            margin >= 20
                              ? 'text-emerald-600'
                              : margin > 0
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {formatPercent(margin)}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {p.currentStock} {p.unit}
                          </span>
                          {isLow && (
                            <Badge variant="danger" className="text-[10px]">
                              نواقص
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* زر طباعة باركود للمنتج */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintSingleProduct(p)}
                            className="text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                            title="طباعة ملصق باركود لهذا الصنف"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>استيكر</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(p)}
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4 text-slate-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف المنتج: ${p.name}؟`)) {
                                deleteProduct(p.id);
                              }
                            }}
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
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

      {/* نافذة إضافة / تعديل منتج (مع التوليد التلقائي للباركود) */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProduct} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                اسم المنتج / الصنف <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: شاحن سامسونج أصلي 25W"
                className="w-full h-11 px-3 text-sm border rounded-xl"
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">الباركود / الكود</label>
                <button
                  type="button"
                  onClick={handleGenerateNewBarcode}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>توليد كود تلقائي</span>
                </button>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="تم توليده تلقائياً أو اكتبه/امسحه"
                  className="flex-1 h-11 px-3 text-sm border rounded-xl font-mono font-bold"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setScannerTarget('form');
                    setIsScannerOpen(true);
                  }}
                  className="px-3"
                  title="مسح بالكاميرا"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">القسم / التصنيف</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="إلكترونيات، كابلات، مفاتيح..."
                className="w-full h-11 px-3 text-sm border rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                سعر الشراء / التكلفة (ج.م) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.costPrice || ''}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full h-11 px-3 text-sm border rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                مصاريف إضافية / شحن (ج.م)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.extraCost || ''}
                onChange={(e) =>
                  setFormData({ ...formData, extraCost: parseFloat(e.target.value) || 0 })
                }
                placeholder="0"
                className="w-full h-11 px-3 text-sm border rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                سعر البيع للجمهور (ج.م) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.salePrice || ''}
                onChange={(e) =>
                  setFormData({ ...formData, salePrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full h-11 px-3 text-sm border rounded-xl font-black text-brand-700"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">هامش الربح المحسوب</label>
              <div className="h-11 px-3 rounded-xl bg-slate-50 border flex items-center justify-between font-mono font-bold text-sm">
                <span>{formatPercent(liveMargin)}</span>
                <span className="text-xs text-slate-400 font-sans">
                  ربح: {formatCurrency(Math.max(0, formData.salePrice - (formData.costPrice + formData.extraCost)))}
                </span>
              </div>
            </div>

            {!editingProduct && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">رصيد أول المدة</label>
                <input
                  type="number"
                  min="0"
                  value={formData.openingStock}
                  onChange={(e) =>
                    setFormData({ ...formData, openingStock: parseInt(e.target.value) || 0 })
                  }
                  className="w-full h-11 px-3 text-sm border rounded-xl"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">حد تنبيه النواقص</label>
              <input
                type="number"
                min="1"
                value={formData.minStockAlert}
                onChange={(e) =>
                  setFormData({ ...formData, minStockAlert: parseInt(e.target.value) || 5 })
                }
                className="w-full h-11 px-3 text-sm border rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">وحدة القياس</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="قطعة، طقم، متر..."
                className="w-full h-11 px-3 text-sm border rounded-xl"
              />
            </div>
          </div>

          <div className="pt-3 border-t flex justify-end gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setIsAddModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="md" saveState={productSaveState}>
              {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* نافذة كاميرا الباركود */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />

      {/* نافذة طباعة ملصقات الباركود */}
      <BarcodeLabelPrinterModal
        isOpen={isLabelPrinterOpen}
        onClose={() => setIsLabelPrinterOpen(false)}
        products={productsToPrint}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">جاري تحميل المنتجات...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
