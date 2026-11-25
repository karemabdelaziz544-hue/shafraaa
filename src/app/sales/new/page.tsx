'use client';

import React, { useState } from 'react';
import {
  ShoppingCart,
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  User,
  CreditCard,
  Percent,
  UserPlus,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { useShop, Product } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { BarcodeScannerModal } from '@/components/barcode-scanner-modal';
import { InvoicePrintView } from '@/components/invoice-print-view';
import { formatCurrency, formatPercent, formatArabicDateTime } from '@/lib/formatters';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export default function NewSalePage() {
  const {
    products,
    customers,
    createSaleInvoice,
    activeDrawer,
    drawerSessions,
    reopenDrawerSession,
    addCustomer,
  } = useShop();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'instapay' | 'credit'>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [isPaidAmountManual, setIsPaidAmountManual] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [invoiceWarning, setInvoiceWarning] = useState<string | null>(null);
  const [completedInvoice, setCompletedInvoice] = useState<any | null>(null);

  // حالة إضافة عميل سريعاً
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [addCustError, setAddCustError] = useState('');
  const [isSavingSale, setIsSavingSale] = useState(false);

  // حالة إغلاق الدرج وحظره
  const isDrawerClosed = !activeDrawer || activeDrawer.status !== 'open';
  const lastClosedSession = drawerSessions.find((s) => s.status === 'closed') || drawerSessions[0];

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setAddCustError('يرجى إدخال اسم العميل');
      return;
    }
    const res = await addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      creditLimit: 0,
      initialBalance: 0,
      notes: 'تمت الإضافة سريعاً من شاشة نقطة البيع',
    });
    if (!res.ok || !res.customer) {
      setAddCustError(res.error || 'تعذر حفظ العميل في قاعدة البيانات');
      return;
    }
    setSelectedCustomerId(res.customer.id);
    setIsAddCustomerOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setAddCustError('');
  };

  // البحث والتصفية في المنتجات
  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  // إضافة منتج للسلة
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: product.salePrice,
          discount: 0,
        },
      ];
    });
  };

  // تعديل كمية
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // تعديل سعر البيع في الفاتورة مباشرة
  const updateUnitPrice = (productId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, unitPrice: Math.max(0, newPrice) } : item
      )
    );
  };

  // حذف بند
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // معالجة قراءة الباركود من الكاميرا
  const handleBarcodeScan = (barcode: string) => {
    const found = products.find((p) => p.barcode === barcode);
    if (found) {
      addToCart(found);
    } else {
      setInvoiceWarning(`لم يتم العثور على منتج بالباركود: ${barcode}`);
    }
  };

  // الحسابات
  const subtotal = cart.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice - item.discount),
    0
  );
  const totalAmount = Math.max(0, subtotal - overallDiscount);
  const actualPaidAmount = isPaidAmountManual
    ? parseFloat(paidAmountInput) || 0
    : paymentMethod === 'credit'
    ? 0
    : totalAmount;
  const remainingDebt = Math.max(0, totalAmount - actualPaidAmount);

  // إتمام وحفظ الفاتورة
  const handleCompleteSale = async () => {
    if (isDrawerClosed) {
      setInvoiceWarning('الدرج مقفل حالياً! لا يمكن إصدار فاتورة بيع جديدة قبل إعادة فتح الدرج بواسطة المالك.');
      return;
    }

    if (cart.length === 0) return;

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      setInvoiceWarning('يجب اختيار عميل مسجل لإتمام البيع الآجل (على الحساب)');
      return;
    }

    setIsSavingSale(true);
    const { ok, invoice, warning, error } = await createSaleInvoice({
      customerId: selectedCustomerId || null,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
      overallDiscount,
      paymentMethod,
      paidAmount: actualPaidAmount,
    });
    setIsSavingSale(false);

    if (!ok || !invoice) {
      setInvoiceWarning(error || warning || 'تعذر حفظ الفاتورة في قاعدة البيانات.');
      return;
    }

    if (warning) {
      setInvoiceWarning(warning);
    } else {
      setInvoiceWarning(null);
    }

    setCompletedInvoice(invoice);
    // تصفير السلة
    setCart([]);
    setOverallDiscount(0);
    setIsPaidAmountManual(false);
    setPaidAmountInput('');
  };

  return (
    <div className="space-y-4">
      {/* رأس الشاشة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-brand-600" />
            <span>نقطة البيع - فاتورة جديدة (POS)</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - اختر الصنف أو امسح الباركود بالكاميرا مباشرة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => setIsScannerOpen(true)}
            className="border-brand-300 text-brand-700 bg-brand-50 hover:bg-brand-100"
          >
            <Camera className="w-4 h-4" />
            <span>مسح الباركود بالكاميرا</span>
          </Button>
        </div>
      </div>

      {/* تنبيه غلق الدرج وحظر البيع */}
      {isDrawerClosed && (
        <div className="p-4 sm:p-5 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-200 text-rose-800 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-rose-900">
                الدرج مقفل حالياً - تم إيقاف إنشاء فواتير البيع
              </h3>
              <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                لا يمكن إنشاء أي فواتير جديدة أثناء إغلاق الدرج لمنع تسجيل حركات مالية بدون وردية نشطة.
                {lastClosedSession?.closedAt && (
                  <span className="block font-semibold mt-0.5 text-rose-800">
                    وقت إغلاق الدرج: {formatArabicDateTime(lastClosedSession.closedAt)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => reopenDrawerSession(lastClosedSession?.id)}
            className="gap-2 shrink-0 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-600/30 w-full sm:w-auto"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة فتح الدرج (صلاحية المالك كريم)</span>
          </Button>
        </div>
      )}

      {invoiceWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{invoiceWarning}</span>
        </div>
      )}

      {/* تخطيط الشاشة: اليمين الأصناف، اليسار سلة الفاتورة والحسابات */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* عمود الكتالوج والأصناف (7 أعمدة) */}
        <div className="lg:col-span-7 space-y-4">
          {/* مربع البحث السريع */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو الباركود أو القسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pr-11 pl-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* شبكة المنتجات ذات اللمس السريع */}
          {filteredProducts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-700">
                {products.length === 0 ? 'لا توجد منتجات مسجلة في هذا المتجر حتى الآن' : 'لا توجد منتجات مطابقة للبحث'}
              </p>
              <p>أضف منتجات من صفحة المنتجات أو عبر فاتورة توريد من الموردين للبدء في البيع.</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto p-1">
            {filteredProducts.map((p) => {
              const isLow = p.currentStock <= p.minStockAlert;
              return (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between select-none active:scale-95"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-semibold text-slate-400 truncate">
                        {p.category}
                      </span>
                      {isLow && (
                        <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded-full">
                          مخزون: {p.currentStock}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-tight">
                      {p.name}
                    </h4>
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs sm:text-sm font-black text-brand-600">
                      {formatCurrency(p.salePrice)}
                    </span>
                    <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-base hover:bg-brand-600 hover:text-white transition-colors">
                      +
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* عمود سلة الفاتورة والدفع (5 أعمدة) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-brand-200 shadow-md">
            <CardHeader className="bg-slate-50/70 py-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between w-full">
                <span>سلة الفاتورة ({cart.length} أصناف)</span>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-rose-600 hover:underline font-normal"
                  >
                    تفريغ السلة
                  </button>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* اختيار العميل مع زر إضافة عميل سريعاً */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>العميل</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAddCustError('');
                      setIsAddCustomerOpen(true);
                    }}
                    className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 py-0.5 px-2 rounded-lg hover:bg-brand-50 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ إضافة عميل سريعاً</span>
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full h-10 px-3 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">عميل نقدي (بدون تسجيل حساب)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} {c.currentBalance > 0 ? `- عليه دين: ${c.currentBalance} ج.م` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* بنود الفاتورة */}
              <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    السلة فارغة. اضغط على أي صنف من القائمة لإضافته.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product.id} className="pt-2 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.product.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateUnitPrice(item.product.id, parseFloat(e.target.value) || 0)
                            }
                            className="w-20 h-7 text-xs px-1.5 border border-slate-200 rounded text-center font-bold"
                            title="تعديل سعر البيع لهذا البند"
                          />
                          <span className="text-[11px] text-slate-400">ج.م/قطعة</span>
                        </div>
                      </div>

                      {/* أزرار الكمية */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-slate-700 hover:bg-slate-200 font-bold"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-bold text-xs">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-slate-700 hover:bg-slate-200 font-bold"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-left min-w-[70px]">
                        <p className="text-xs font-black text-slate-900">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </p>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-rose-500 hover:text-rose-700 text-[10px] mt-0.5"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* طرق الدفع المصرية */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700">طريقة السداد</label>
                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setIsPaidAmountManual(false);
                    }}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('wallet');
                      setIsPaidAmountManual(false);
                    }}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      paymentMethod === 'wallet'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    محفظة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('instapay');
                      setIsPaidAmountManual(false);
                    }}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      paymentMethod === 'instapay'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    إنستاباي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('credit');
                      setIsPaidAmountManual(true);
                      setPaidAmountInput('0');
                    }}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      paymentMethod === 'credit'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    آجل
                  </button>
                </div>
              </div>

              {/* الخصم والمبلغ المدفوع */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-[11px] font-bold text-slate-600">خصم إضافي (ج.م)</label>
                  <input
                    type="number"
                    value={overallDiscount || ''}
                    placeholder="0"
                    onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-2 text-xs border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600">المبلغ المدفوع (ج.م)</label>
                  <input
                    type="number"
                    value={isPaidAmountManual ? paidAmountInput : actualPaidAmount}
                    onChange={(e) => {
                      setIsPaidAmountManual(true);
                      setPaidAmountInput(e.target.value);
                    }}
                    className="w-full h-9 px-2 text-xs border rounded-lg font-bold text-emerald-700"
                  />
                </div>
              </div>

              {/* ملخص المبالغ والزر الكبير */}
              <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {overallDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>الخصم:</span>
                    <span>-{formatCurrency(overallDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 border-t pt-1">
                  <span>الإجمالي المطلوب:</span>
                  <span className="text-brand-700">{formatCurrency(totalAmount)}</span>
                </div>
                {remainingDebt > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold border-t pt-1">
                    <span>دين يسجل على العميل:</span>
                    <span>{formatCurrency(remainingDebt)}</span>
                  </div>
                )}
              </div>

              <Button
                size="xl"
                variant={isDrawerClosed ? 'outline' : 'primary'}
                disabled={cart.length === 0 || isDrawerClosed || isSavingSale}
                isLoading={isSavingSale}
                onClick={handleCompleteSale}
                className={`w-full h-14 text-base font-bold shadow-lg transition-all ${
                  isDrawerClosed
                    ? 'border-rose-300 bg-rose-50 text-rose-700 cursor-not-allowed shadow-none'
                    : 'shadow-brand-500/25'
                }`}
              >
                {isDrawerClosed ? (
                  <>
                    <Lock className="w-5 h-5 ml-2 text-rose-600" />
                    <span>الدرج مقفل - يرجى إعادة فتح الوردية للبيع</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 ml-2" />
                    <span>إتمام وحفظ الفاتورة ({formatCurrency(totalAmount)})</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* نافذة إضافة عميل سريعاً */}
      <Dialog
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        title="إضافة عميل جديد سريعاً"
        description="سجل اسم وهاتف العميل ليتم اختياره فوراً في هذه الفاتورة"
        maxWidth="sm"
      >
        <form onSubmit={handleQuickAddCustomer} className="p-4 sm:p-5 space-y-4">
          {addCustError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
              {addCustError}
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              اسم العميل <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="مثال: أحمد محمود"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              رقم الهاتف
            </label>
            <Input
              type="tel"
              dir="ltr"
              placeholder="010xxxxxxxx"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsAddCustomerOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="md">
              حفظ واختيار العميل
            </Button>
          </div>
        </form>
      </Dialog>

      {/* نافذة كاميرا الباركود */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

      {/* نافذة طباعة الإيصال عند الانتهاء */}
      {completedInvoice && (
        <InvoicePrintView
          invoice={completedInvoice}
          showSuccessBanner={true}
          onClose={() => setCompletedInvoice(null)}
        />
      )}
    </div>
  );
}
