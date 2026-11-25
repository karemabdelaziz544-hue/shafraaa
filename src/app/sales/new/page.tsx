'use client';

import React, { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, m } from 'framer-motion';
import {
  ShoppingCart,
  Search,
  Camera,
  CheckCircle2,
  AlertTriangle,
  User,
  UserPlus,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { useShop, Product } from '@/lib/store/shop-store';
import { Button, SaveButtonState } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { PosSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/motion/toast-provider';
import { LIST_ITEM_TRANSITION } from '@/lib/motion';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

const BarcodeScannerModal = dynamic(
  () => import('@/components/barcode-scanner-modal').then((mod) => mod.BarcodeScannerModal),
  { ssr: false }
);

const InvoicePrintView = dynamic(
  () => import('@/components/invoice-print-view').then((mod) => mod.InvoicePrintView),
  { ssr: false }
);

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
    can,
    isInitialLoading,
  } = useShop();
  const { successToast } = useToast();

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

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [addCustError, setAddCustError] = useState('');
  const [saleSaveState, setSaleSaveState] = useState<SaveButtonState>('idle');
  const [custSaveState, setCustSaveState] = useState<SaveButtonState>('idle');
  const saleLockRef = useRef(false);
  const custLockRef = useRef(false);

  if (isInitialLoading) {
    return <PosSkeleton />;
  }

  const isDrawerClosed = !activeDrawer || activeDrawer.status !== 'open';
  const lastClosedSession = drawerSessions.find((s) => s.status === 'closed') || drawerSessions[0];

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (custLockRef.current) return;
    if (!newCustName.trim()) {
      setAddCustError('يرجى إدخال اسم العميل');
      return;
    }
    custLockRef.current = true;
    setCustSaveState('saving');
    const res = await addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      creditLimit: 0,
      initialBalance: 0,
      notes: 'تمت الإضافة سريعاً من شاشة نقطة البيع',
    });
    if (!res.ok || !res.customer) {
      setCustSaveState('idle');
      custLockRef.current = false;
      setAddCustError(res.error || 'تعذر حفظ العميل في قاعدة البيانات');
      return;
    }
    setCustSaveState('saved');
    setSelectedCustomerId(res.customer.id);
    setTimeout(() => {
      setCustSaveState('idle');
      custLockRef.current = false;
      setIsAddCustomerOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setAddCustError('');
    }, 450);
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

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
    successToast(`أضيف "${product.name}" إلى السلة`);
  };

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

  const updateUnitPrice = (productId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, unitPrice: Math.max(0, newPrice) } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleBarcodeScan = (barcode: string) => {
    const found = products.find((p) => p.barcode === barcode);
    if (found) {
      addToCart(found);
    } else {
      setInvoiceWarning(`لم يتم العثور على منتج بالباركود: ${barcode}`);
    }
  };

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

  const handleCompleteSale = async () => {
    if (saleLockRef.current) return;
    if (isDrawerClosed) {
      setInvoiceWarning('الدرج مقفل حالياً! لا يمكن إصدار فاتورة بيع جديدة قبل إعادة فتح الدرج بواسطة المالك.');
      return;
    }

    if (cart.length === 0) return;

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      setInvoiceWarning('يجب اختيار عميل مسجل لإتمام البيع الآجل (على الحساب)');
      return;
    }

    saleLockRef.current = true;
    setSaleSaveState('saving');
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

    if (!ok || !invoice) {
      setSaleSaveState('idle');
      saleLockRef.current = false;
      setInvoiceWarning(error || warning || 'تعذر حفظ الفاتورة في قاعدة البيانات.');
      return;
    }

    setSaleSaveState('saved');
    if (warning) {
      setInvoiceWarning(warning);
    } else {
      setInvoiceWarning(null);
    }

    setCompletedInvoice(invoice);
    setCart([]);
    setOverallDiscount(0);
    setIsPaidAmountManual(false);
    setPaidAmountInput('');
    setTimeout(() => {
      setSaleSaveState('idle');
      saleLockRef.current = false;
    }, 800);
  };

  return (
    <div className="space-y-4">
      {/* رأس الشاشة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <ShoppingCart strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>نقطة البيع - فاتورة جديدة (POS)</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا كريم - اختر الصنف أو امسح الباركود بالكاميرا مباشرة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => setIsScannerOpen(true)}
            className="border-flame bg-flame/15 text-ink-strong hover:bg-flame/30 font-bold"
          >
            <Camera strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
            <span>مسح الباركود بالكاميرا</span>
          </Button>
        </div>
      </div>

      {/* تنبيه غلق الدرج وحظر البيع */}
      {isDrawerClosed && (
        <div className="p-4 sm:p-5 bg-danger-bg border-2 border-danger-border rounded-2xl text-ink-strong flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-card">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-truffle text-truffle-ink flex items-center justify-center shrink-0">
              <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-danger-text">
                الدرج مقفل حالياً - تم إيقاف إنشاء فواتير البيع
              </h3>
              <p className="text-xs text-ink mt-0.5 leading-relaxed">
                لا يمكن إنشاء أي فواتير جديدة أثناء إغلاق الدرج لمنع تسجيل حركات مالية بدون وردية نشطة.
                {lastClosedSession?.closedAt && (
                  <span className="block font-semibold mt-0.5 text-danger-text">
                    وقت إغلاق الدرج: {formatArabicDateTime(lastClosedSession.closedAt)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {can('drawer.reopen') ? (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => reopenDrawerSession(lastClosedSession?.id)}
              className="gap-2 shrink-0 font-bold w-full sm:w-auto"
            >
              <RotateCcw strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
              <span>إعادة فتح الدرج</span>
            </Button>
          ) : (
            <Badge variant="danger" className="shrink-0">
              صلاحية إعادة فتح الدرج للمدير فقط
            </Badge>
          )}
        </div>
      )}

      {invoiceWarning && (
        <div className="p-3 bg-warning-bg border border-warning-border rounded-xl text-xs text-warning font-bold flex items-center gap-2">
          <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 shrink-0 text-warning" />
          <span>{invoiceWarning}</span>
        </div>
      )}

      {/* تخطيط الشاشة */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* عمود الكتالوج والأصناف */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-ink-muted absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو الباركود أو القسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pr-11 pl-4 rounded-xl border border-line bg-surface text-ink-strong placeholder:text-ink-muted text-sm focus:border-flame focus:outline-none focus:ring-2 focus:ring-flame/25"
            />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-surface border border-line text-center text-xs text-ink-muted space-y-2">
              <p className="font-bold text-ink-strong">
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
                    className="group bg-surface p-3.5 rounded-2xl border border-line hover:border-flame hover:shadow-card transition-all cursor-pointer flex flex-col justify-between select-none active:scale-95"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-semibold text-ink-muted truncate">
                          {p.category}
                        </span>
                        {isLow && (
                          <span className="text-[10px] bg-danger-bg text-danger-text border border-danger-border font-bold px-1.5 py-0.5 rounded-full">
                            مخزون: {p.currentStock}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-ink-strong line-clamp-2 leading-tight">
                        {p.name}
                      </h4>
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-divider">
                      <span className="text-xs sm:text-sm font-black text-truffle dark:text-flame">
                        {formatCurrency(p.salePrice)}
                      </span>
                      <span className="w-7 h-7 rounded-lg bg-flame/25 text-abyssal dark:text-flame flex items-center justify-center font-bold text-base group-hover:bg-flame group-hover:text-abyssal transition-colors">
                        +
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* عمود سلة الفاتورة والدفع */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-line shadow-elevated">
            <CardHeader className="bg-surface-alt py-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between w-full">
                <span>سلة الفاتورة ({cart.length} أصناف)</span>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-danger-text hover:underline font-bold"
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
                  <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <User strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 text-ink-muted" />
                    <span>العميل</span>
                  </label>
                  {can('customers.create') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddCustError('');
                        setIsAddCustomerOpen(true);
                      }}
                      className="text-xs font-bold text-truffle dark:text-flame flex items-center gap-1 py-0.5 px-2 rounded-lg hover:bg-flame/20 transition-colors"
                    >
                      <UserPlus strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                      <span>+ إضافة عميل سريعاً</span>
                    </button>
                  )}
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full h-10 px-3 text-xs sm:text-sm border border-line rounded-xl bg-surface text-ink-strong focus:outline-none focus:border-flame"
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
              <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-divider">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-ink-muted text-xs">
                    السلة فارغة. اضغط على أي صنف من القائمة لإضافته.
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {cart.map((item) => (
                      <m.div
                        key={item.product.id}
                        initial={LIST_ITEM_TRANSITION.initial}
                        animate={LIST_ITEM_TRANSITION.animate}
                        exit={LIST_ITEM_TRANSITION.exit}
                        transition={LIST_ITEM_TRANSITION.transition}
                        className="pt-2 flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-ink-strong truncate">
                            {item.product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateUnitPrice(item.product.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 h-7 text-xs px-1.5 border border-line bg-surface text-ink-strong rounded text-center font-bold focus:outline-none focus:border-flame"
                              title="تعديل سعر البيع لهذا البند"
                            />
                            <span className="text-[11px] text-ink-muted">ج.م/قطعة</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 bg-surface-alt border border-line p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center text-ink-strong hover:bg-oatmeal/60 font-bold active:scale-95 transition-transform"
                          >
                            -
                          </button>
                          <span className="w-7 text-center font-bold text-xs text-ink-strong">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center text-ink-strong hover:bg-oatmeal/60 font-bold active:scale-95 transition-transform"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-left min-w-[70px]">
                          <p className="text-xs font-black text-ink-strong">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-danger-text hover:underline text-[10px] mt-0.5 font-semibold"
                          >
                            حذف
                          </button>
                        </div>
                      </m.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* طرق الدفع المصرية */}
              <div className="space-y-2 pt-2 border-t border-divider">
                <label className="text-xs font-bold text-ink">طريقة السداد</label>
                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setIsPaidAmountManual(false);
                    }}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      paymentMethod === 'cash'
                        ? 'bg-success text-success-ink border-success'
                        : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
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
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      paymentMethod === 'wallet'
                        ? 'bg-flame text-abyssal border-flame'
                        : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
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
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      paymentMethod === 'instapay'
                        ? 'bg-fantastic text-palladian border-fantastic'
                        : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
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
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      paymentMethod === 'credit'
                        ? 'bg-truffle text-truffle-ink border-truffle'
                        : 'bg-surface-alt text-ink border-line hover:bg-oatmeal/50'
                    }`}
                  >
                    آجل
                  </button>
                </div>
              </div>

              {/* الخصم والمبلغ المدفوع */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-divider">
                <div>
                  <label className="text-[11px] font-bold text-ink">خصم إضافي (ج.م)</label>
                  {can('pos.apply_discount') ? (
                    <input
                      type="number"
                      value={overallDiscount || ''}
                      placeholder="0"
                      onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full h-9 px-2 text-xs border border-line bg-surface text-ink-strong rounded-lg focus:outline-none focus:border-flame"
                    />
                  ) : (
                    <div className="w-full h-9 px-2 text-[11px] border border-line bg-surface-alt text-ink-muted rounded-lg flex items-center">
                      الخصم غير مصرح به
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ink">المبلغ المدفوع (ج.م)</label>
                  <input
                    type="number"
                    value={isPaidAmountManual ? paidAmountInput : actualPaidAmount}
                    onChange={(e) => {
                      setIsPaidAmountManual(true);
                      setPaidAmountInput(e.target.value);
                    }}
                    className="w-full h-9 px-2 text-xs border border-line bg-surface rounded-lg font-bold text-success focus:outline-none focus:border-flame"
                  />
                </div>
              </div>

              {/* ملخص المبالغ والزر الكبير */}
              <div className="bg-surface-alt border border-line p-3 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>المجموع:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {overallDiscount > 0 && (
                  <div className="flex justify-between text-danger-text font-bold">
                    <span>الخصم:</span>
                    <span>-{formatCurrency(overallDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-ink-strong border-t border-divider pt-1">
                  <span>الإجمالي المطلوب:</span>
                  <span className="text-truffle dark:text-flame">{formatCurrency(totalAmount)}</span>
                </div>
                {remainingDebt > 0 && (
                  <div className="flex justify-between text-danger-text font-bold border-t border-divider pt-1">
                    <span>دين يسجل على العميل:</span>
                    <span>{formatCurrency(remainingDebt)}</span>
                  </div>
                )}
              </div>

              <Button
                size="xl"
                variant={isDrawerClosed ? 'outline' : 'primary'}
                disabled={cart.length === 0 || isDrawerClosed}
                saveState={saleSaveState}
                savedText="تم حفظ الفاتورة"
                onClick={handleCompleteSale}
                className={`w-full h-14 text-base font-bold transition-all ${
                  isDrawerClosed
                    ? 'border-danger-border bg-danger-bg text-danger-text cursor-not-allowed shadow-none'
                    : 'shadow-accent'
                }`}
              >
                {isDrawerClosed ? (
                  <>
                    <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 ml-2 text-danger-text" />
                    <span>الدرج مقفل - يرجى إعادة فتح الوردية للبيع</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 ml-2" />
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
            <div className="p-2.5 bg-danger-bg border border-danger-border rounded-xl text-xs text-danger-text font-bold">
              {addCustError}
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              اسم العميل <span className="text-danger-text">*</span>
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
            <label className="text-xs font-bold text-ink block mb-1">
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

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-divider">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsAddCustomerOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="md" saveState={custSaveState}>
              حفظ واختيار العميل
            </Button>
          </div>
        </form>
      </Dialog>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

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
