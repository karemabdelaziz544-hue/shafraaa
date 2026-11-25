'use client';

import React, { useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import {
  Truck,
  Plus,
  Search,
  Phone,
  DollarSign,
  PackagePlus,
  Receipt,
  Camera,
  Image as ImageIcon,
  Eye,
  CheckCircle2,
  Trash2,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { useShop, Supplier, PurchaseInvoice } from '@/lib/store/shop-store';
import { Button, SaveButtonState } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { LIST_ITEM_TRANSITION } from '@/lib/motion';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

interface PurchaseLineFormItem {
  isNew: boolean;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
}

export default function SuppliersPage() {
  const {
    suppliers,
    products,
    purchaseInvoices,
    supplierPayments,
    addSupplier,
    addSupplierPayment,
    createPurchaseInvoice,
    isInitialLoading,
  } = useShop();

  const [purchaseSaveState, setPurchaseSaveState] = useState<SaveButtonState>('idle');
  const purchaseLockRef = useRef(false);

  const [activeTab, setActiveTab] = useState<'suppliers' | 'invoices'>('suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseInvoice | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'instapay' | 'bank'>('cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    phone: '',
    initialBalance: 0,
  });

  const [purchaseData, setPurchaseData] = useState<{
    items: PurchaseLineFormItem[];
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'bank';
    paidAmount: number;
    isPaidAmountManual: boolean;
    notes: string;
    invoicePhotoUrl: string | null;
  }>({
    items: [{ isNew: false, productId: '', productName: '', quantity: 1, unitCost: 0, salePrice: 0 }],
    paymentMethod: 'cash',
    paidAmount: 0,
    isPaidAmountManual: false,
    notes: '',
    invoicePhotoUrl: null,
  });

  const calculatedSubtotal = purchaseData.items.reduce(
    (sum, item) => sum + item.quantity * (item.unitCost || 0),
    0
  );

  const updatePurchaseItem = (idx: number, updates: Partial<PurchaseLineFormItem>) => {
    const newItems = [...purchaseData.items];
    newItems[idx] = { ...newItems[idx], ...updates };

    const newSubtotal = newItems.reduce(
      (sum, item) => sum + item.quantity * (item.unitCost || 0),
      0
    );

    setPurchaseData((prev) => ({
      ...prev,
      items: newItems,
      paidAmount: prev.isPaidAmountManual ? prev.paidAmount : newSubtotal,
    }));
  };

  const addPurchaseLine = () => {
    setPurchaseData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { isNew: false, productId: '', productName: '', quantity: 1, unitCost: 0, salePrice: 0 },
      ],
    }));
  };

  const removePurchaseLine = (idx: number) => {
    const newItems = purchaseData.items.filter((_, i) => i !== idx);
    const newSubtotal = newItems.reduce(
      (sum, item) => sum + item.quantity * (item.unitCost || 0),
      0
    );
    setPurchaseData((prev) => ({
      ...prev,
      items: newItems,
      paidAmount: prev.isPaidAmountManual ? prev.paidAmount : newSubtotal,
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPurchaseData((prev) => ({
          ...prev,
          invoicePhotoUrl: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q));
  });

  const filteredInvoices = purchaseInvoices.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.supplierName.toLowerCase().includes(q)
    );
  });

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierData.name.trim()) return;

    const res = await addSupplier({
      name: newSupplierData.name.trim(),
      phone: newSupplierData.phone.trim(),
      initialBalance: newSupplierData.initialBalance,
      notes: '',
    });

    if (!res.ok) {
      alert(res.error || 'تعذر حفظ المورد في قاعدة البيانات');
      return;
    }

    setIsAddSupplierOpen(false);
    setNewSupplierData({ name: '', phone: '', initialBalance: 0 });
  };

  const handleConfirmSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) return;

    const res = await addSupplierPayment({
      supplierId: selectedSupplier.id,
      amount: amt,
      method: paymentMethod,
      date: paymentDate,
      notes: paymentNotes,
    });

    if (!res.ok) {
      alert(res.error || 'تعذر تسجيل الدفعة للمورد في قاعدة البيانات');
      return;
    }

    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || purchaseLockRef.current) return;

    const validItems = purchaseData.items.filter(
      (i) => (i.productId || i.productName.trim()) && i.quantity > 0
    );
    if (validItems.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل بالفاتورة مع تحديد الكمية والتكلفة.');
      return;
    }

    purchaseLockRef.current = true;
    setPurchaseSaveState('saving');
    const res = await createPurchaseInvoice({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      items: validItems.map((item) => ({
        isNew: item.isNew,
        productId: item.isNew ? undefined : item.productId,
        productName: item.isNew ? item.productName : undefined,
        quantity: item.quantity,
        unitCost: item.unitCost,
        salePrice: item.isNew ? item.salePrice : undefined,
      })),
      paymentMethod: purchaseData.paymentMethod,
      paidAmount: purchaseData.paidAmount,
      invoicePhotoUrl: purchaseData.invoicePhotoUrl,
      notes: purchaseData.notes,
    });

    if (!res.ok) {
      setPurchaseSaveState('idle');
      purchaseLockRef.current = false;
      return;
    }

    setPurchaseSaveState('saved');
    setTimeout(() => {
      setPurchaseSaveState('idle');
      purchaseLockRef.current = false;
      setIsPurchaseModalOpen(false);
      setPurchaseData({
        items: [{ isNew: false, productId: '', productName: '', quantity: 1, unitCost: 0, salePrice: 0 }],
        paymentMethod: 'cash',
        paidAmount: 0,
        isPaidAmountManual: false,
        notes: '',
        invoicePhotoUrl: null,
      });
    }, 450);
  };

  const openPurchaseModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setPurchaseData({
      items: [{ isNew: false, productId: '', productName: '', quantity: 1, unitCost: 0, salePrice: 0 }],
      paymentMethod: 'cash',
      paidAmount: 0,
      isPaidAmountManual: false,
      notes: '',
      invoicePhotoUrl: null,
    });
    setIsPurchaseModalOpen(true);
  };

  const openPaymentModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setPaymentAmount(s.owedBalance > 0 ? String(s.owedBalance) : '');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const getSupplierLedger = (supplierId: string) => {
    interface LedgerEntry {
      id: string;
      date: string;
      type: 'INVOICE' | 'PAYMENT';
      title: string;
      reference: string;
      method?: string;
      debitOwed: number;
      creditPaid: number;
      notes?: string;
    }

    const entries: LedgerEntry[] = [];

    purchaseInvoices
      .filter((inv) => inv.supplierId === supplierId)
      .forEach((inv) => {
        entries.push({
          id: inv.id,
          date: inv.createdAt,
          type: 'INVOICE',
          title: `فاتورة توريد بضاعة #${inv.invoiceNumber}`,
          reference: inv.invoiceNumber,
          method: inv.paymentMethod,
          debitOwed: inv.totalAmount,
          creditPaid: 0,
          notes: inv.notes,
        });
      });

    supplierPayments
      .filter((pay) => pay.supplierId === supplierId)
      .forEach((pay) => {
        entries.push({
          id: pay.id,
          date: pay.paymentDate || pay.createdAt,
          type: 'PAYMENT',
          title: 'سداد دفعة للمورد',
          reference: pay.notes || 'سداد نقدي/إلكتروني',
          method: pay.paymentMethod,
          debitOwed: 0,
          creditPaid: pay.amount,
          notes: pay.notes,
        });
      });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const ledgerWithBalance = entries.map((entry) => {
      runningBalance = runningBalance + entry.debitOwed - entry.creditPaid;
      return {
        ...entry,
        runningBalance: Number(runningBalance.toFixed(2)),
      };
    });

    return ledgerWithBalance.reverse();
  };

  return (
    <div className="space-y-5">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <Truck strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>الموردين وفواتير الشراء وكشف الحساب</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا كريم - تسجيل فواتير التوريد (أصناف قديمة أو جديدة) وكشف حساب تفصيلي لكل مورد وسداد الدفعات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" onClick={() => setIsAddSupplierOpen(true)}>
            <Plus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1" />
            <span>إضافة مورد جديد</span>
          </Button>
        </div>
      </div>

      {/* التبديل بين التبويبات */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
            activeTab === 'suppliers'
              ? 'bg-flame text-abyssal shadow-sm'
              : 'bg-surface text-ink hover:bg-surface-alt border border-line'
          }`}
        >
          <Truck strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
          <span>الموردين وكشوف الحساب ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
            activeTab === 'invoices'
              ? 'bg-flame text-abyssal shadow-sm'
              : 'bg-surface text-ink hover:bg-surface-alt border border-line'
          }`}
        >
          <Receipt strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
          <span>سجل فواتير الشراء والتوريد ({purchaseInvoices.length})</span>
        </button>
      </div>

      {/* شريط البحث */}
      <div className="relative">
        <Search strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-ink-muted absolute right-3.5 top-3" />
        <input
          type="text"
          placeholder={
            activeTab === 'suppliers'
              ? 'ابحث باسم المورد أو رقم الهاتف...'
              : 'ابحث برقم الفاتورة أو اسم المورد...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pr-11 pl-4 rounded-xl border border-line bg-surface text-ink-strong placeholder:text-ink-muted text-sm focus:border-flame focus:outline-none focus:ring-2 focus:ring-flame/25"
        />
      </div>

      {/* التبويب 1 */}
      {activeTab === 'suppliers' && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {isInitialLoading ? (
              <TableSkeletonRows columns={5} rows={5} />
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-12 text-center text-ink-muted text-sm">
                لا يوجد موردين مطابقين للبحث.
              </div>
            ) : (
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                  <tr>
                    <th className="p-3 sm:p-4">اسم المورد</th>
                    <th className="p-3 sm:p-4">رقم الهاتف</th>
                    <th className="p-3 sm:p-4">المستحق للمورد (دين علينا)</th>
                    <th className="p-3 sm:p-4 text-center">إجراءات المورد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-alt/60 transition-colors">
                      <td className="p-3 sm:p-4">
                        <p className="font-bold text-ink-strong text-sm">{s.name}</p>
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-ink-muted">
                        {s.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 text-ink-muted" />
                            <span>{s.phone}</span>
                          </span>
                        ) : (
                          <span className="text-ink-muted">غير مسجل</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-black">
                        {s.owedBalance > 0 ? (
                          <span className="text-danger-text font-bold text-sm">
                            {formatCurrency(s.owedBalance)}
                          </span>
                        ) : (
                          <span className="text-success font-bold">خالص (0.00 ج.م)</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLedgerSupplier(s)}
                            className="text-xs gap-1 font-bold"
                          >
                            <BookOpen strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                            <span>كشف الحساب</span>
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openPurchaseModal(s)}
                            className="text-xs gap-1"
                          >
                            <PackagePlus strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                            <span>فاتورة توريد</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPaymentModal(s)}
                            className="text-danger-text border-danger-border hover:bg-danger-bg text-xs font-bold gap-1"
                          >
                            <DollarSign strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                            <span>سداد دفعة</span>
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
      )}

      {/* التبويب 2 */}
      {activeTab === 'invoices' && (
        <Card>
          <CardHeader className="py-3 bg-surface-alt border-b border-line">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>جميع فواتير الشراء والتوريد المسجلة ({filteredInvoices.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {isInitialLoading ? (
              <TableSkeletonRows columns={7} rows={5} />
            ) : filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-ink-muted text-sm">
                لا توجد فواتير شراء وتوريد مسجلة حتى الآن.
              </div>
            ) : (
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                  <tr>
                    <th className="p-3 sm:p-4">رقم الفاتورة</th>
                    <th className="p-3 sm:p-4">المورد</th>
                    <th className="p-3 sm:p-4">التاريخ</th>
                    <th className="p-3 sm:p-4">إجمالي الفاتورة</th>
                    <th className="p-3 sm:p-4">المدفوع</th>
                    <th className="p-3 sm:p-4">المتبقي دين</th>
                    <th className="p-3 sm:p-4 text-center">صورة الفاتورة</th>
                    <th className="p-3 sm:p-4 text-center">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-surface-alt/60 transition-colors">
                      <td className="p-3 sm:p-4 font-mono font-bold text-ink-strong">
                        {inv.invoiceNumber}
                      </td>
                      <td className="p-3 sm:p-4 font-bold text-ink">
                        {inv.supplierName}
                      </td>
                      <td className="p-3 sm:p-4 text-ink-muted text-[11px]">
                        {formatArabicDateTime(inv.createdAt)}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-black text-ink-strong">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-success font-bold">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-bold">
                        {inv.remainingAmount > 0 ? (
                          <span className="text-danger-text font-bold">
                            {formatCurrency(inv.remainingAmount)}
                          </span>
                        ) : (
                          <span className="text-success">مسدد بالكامل</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        {inv.invoicePhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setEnlargedPhoto(inv.invoicePhotoUrl || null)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-info-bg border border-info-border text-ink-strong hover:border-flame text-xs font-bold transition-colors"
                          >
                            <ImageIcon strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                            <span>مرفقة</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-ink-muted">بدون صورة</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingInvoice(inv)}
                          className="text-xs gap-1"
                        >
                          <Eye strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                          <span>عرض الفاتورة</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* نافذة كشف حساب المورد التفصيلي */}
      {ledgerSupplier && (
        <Dialog
          isOpen={true}
          onClose={() => setLedgerSupplier(null)}
          title={`كشف حساب الأستاذ العام للمورد: ${ledgerSupplier.name}`}
          maxWidth="2xl"
        >
          <div className="p-4 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface-alt p-3.5 rounded-2xl border border-line">
                <span className="text-xs text-ink-muted block mb-0.5">رقم الهاتف:</span>
                <span className="font-mono font-bold text-ink-strong text-sm">
                  {ledgerSupplier.phone || 'غير مسجل'}
                </span>
              </div>

              <div className="bg-danger-bg p-3.5 rounded-2xl border border-danger-border">
                <span className="text-xs text-danger-text block mb-0.5">الرصيد المتبقي مستحق للمورد (دين):</span>
                <span className="font-mono font-black text-danger-text text-lg">
                  {formatCurrency(ledgerSupplier.owedBalance)}
                </span>
              </div>

              <div className="flex items-center justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => openPaymentModal(ledgerSupplier)}
                  className="w-full gap-1.5 font-bold"
                >
                  <DollarSign strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                  <span>تسجيل سداد دفعة للمورد</span>
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-ink mb-2">
                سجل الحركات المالية المتبادلة (فواتير التوريد وسدادات الدفعات):
              </h4>
              <div className="border border-line rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-surface-alt text-ink font-bold border-b border-line sticky top-0">
                    <tr>
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5">نوع الحركة</th>
                      <th className="p-2.5">البيان / طريقة السداد</th>
                      <th className="p-2.5 text-center text-danger-text">مستحق للمورد (+)</th>
                      <th className="p-2.5 text-center text-success">مسدد للمورد (-)</th>
                      <th className="p-2.5 text-left font-black text-ink-strong">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider bg-surface">
                    {getSupplierLedger(ledgerSupplier.id).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-ink-muted">
                          لا توجد حركات مسجلة لهذا المورد حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      getSupplierLedger(ledgerSupplier.id).map((row) => (
                        <tr
                          key={row.id}
                          className={
                            row.type === 'PAYMENT'
                              ? 'bg-success-bg/35 hover:bg-success-bg/60'
                              : 'hover:bg-surface-alt/60'
                          }
                        >
                          <td className="p-2.5 font-mono text-ink-muted text-[11px]">
                            {row.date.split('T')[0]}
                          </td>
                          <td className="p-2.5 font-bold">
                            {row.type === 'INVOICE' ? (
                              <Badge variant="info" className="text-[10px]">
                                توريد بضاعة
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                سداد دفعة
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 text-ink-strong">
                            <span className="font-semibold block">{row.title}</span>
                            {row.method && (
                              <span className="text-[10px] text-ink-muted">
                                طريقة: {row.method === 'cash' ? 'كاش' : row.method === 'wallet' ? 'محفظة' : row.method === 'instapay' ? 'إنستاباي' : 'آجل/تحويل'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-danger-text" dir="ltr">
                            {row.debitOwed > 0 ? `+${formatCurrency(row.debitOwed)}` : '-'}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-success" dir="ltr">
                            {row.creditPaid > 0 ? `-${formatCurrency(row.creditPaid)}` : '-'}
                          </td>
                          <td className="p-2.5 text-left font-mono font-black text-ink-strong" dir="ltr">
                            {formatCurrency(row.runningBalance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-divider">
              <Button variant="outline" size="md" onClick={() => setLedgerSupplier(null)}>
                إغلاق كشف الحساب
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* نافذة تسجيل فاتورة شراء وتوريد بضاعة */}
      {isPurchaseModalOpen && selectedSupplier && (
        <Dialog
          isOpen={true}
          onClose={() => setIsPurchaseModalOpen(false)}
          title={`تسجيل فاتورة توريد من: ${selectedSupplier.name}`}
          maxWidth="xl"
        >
          <form onSubmit={handleCreatePurchase} className="p-4 sm:p-6 space-y-5">
            <div className="p-3 bg-info-bg border border-info-border rounded-xl text-xs text-ink-strong leading-relaxed flex items-center gap-2">
              <Sparkles strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-truffle dark:text-flame shrink-0" />
              <span>
                أهلًا يا كريم: يمكنك اختيار صنف موجود من الكتالوج أو كتابة اسم صنف جديد باليد وسيتم إنشاؤه في النظام تلقائياً وتوليد باركوده فوراً!
              </span>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-ink-strong block">بنود الفاتورة الموردة:</label>

              <AnimatePresence initial={false}>
                {purchaseData.items.map((item, idx) => (
                  <m.div
                    key={idx}
                    initial={LIST_ITEM_TRANSITION.initial}
                    animate={LIST_ITEM_TRANSITION.animate}
                    exit={LIST_ITEM_TRANSITION.exit}
                    transition={LIST_ITEM_TRANSITION.transition}
                    className="bg-surface-alt p-3.5 rounded-2xl border border-line space-y-2.5"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-divider">
                      <span className="text-xs font-bold text-ink">بند #{idx + 1}</span>

                      <div className="inline-flex items-center gap-1 bg-surface p-1 rounded-xl border border-line text-xs">
                        <button
                          type="button"
                          onClick={() => updatePurchaseItem(idx, { isNew: false, productName: '' })}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                            !item.isNew
                              ? 'bg-flame text-abyssal'
                              : 'text-ink hover:bg-surface-alt'
                          }`}
                        >
                          صنف من الكتالوج
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePurchaseItem(idx, { isNew: true, productId: '' })}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-colors inline-flex items-center gap-1 ${
                            item.isNew
                              ? 'bg-fantastic text-palladian'
                              : 'text-ink hover:bg-surface-alt'
                          }`}
                        >
                          <Sparkles strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                          <span>صنف جديد (كتابة يدوية)</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2.5 items-end">
                      <div className={item.isNew ? 'col-span-12 sm:col-span-5' : 'col-span-12 sm:col-span-6'}>
                        <label className="text-[11px] font-bold text-ink block mb-1">
                          {item.isNew ? 'اسم الصنف الجديد *' : 'اختر الصنف من الكتالوج *'}
                        </label>
                        {item.isNew ? (
                          <input
                            type="text"
                            required
                            placeholder="اكتب اسم الصنف الجديد هنا (مثال: ريموت سيارة كيا كود 4)..."
                            value={item.productName}
                            onChange={(e) => updatePurchaseItem(idx, { productName: e.target.value })}
                            className="w-full h-10 px-3 text-xs border border-flame rounded-xl bg-surface text-ink-strong placeholder:text-ink-muted font-bold focus:outline-none focus:ring-2 focus:ring-flame/25"
                          />
                        ) : (
                          <select
                            value={item.productId}
                            onChange={(e) => {
                              const pid = e.target.value;
                              const prod = products.find((p) => p.id === pid);
                              updatePurchaseItem(idx, {
                                productId: pid,
                                productName: prod ? prod.name : '',
                                unitCost: prod ? prod.costPrice : 0,
                              });
                            }}
                            className="w-full h-10 px-3 text-xs border border-line rounded-xl bg-surface text-ink-strong font-bold focus:outline-none focus:border-flame"
                            required
                          >
                            <option value="">اختر الصنف...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.barcode ? `(${p.barcode})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        <label className="text-[11px] font-bold text-ink block mb-1">الكمية</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            updatePurchaseItem(idx, { quantity: parseInt(e.target.value) || 1 })
                          }
                          className="w-full h-10 px-2 text-xs border border-line bg-surface text-ink-strong rounded-xl text-center font-bold focus:outline-none focus:border-flame"
                        />
                      </div>

                      <div className={item.isNew ? 'col-span-4 sm:col-span-2' : 'col-span-5 sm:col-span-3'}>
                        <label className="text-[11px] font-bold text-ink block mb-1">
                          سعر التكلفة (ج.م)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="0.00"
                          value={item.unitCost || ''}
                          onChange={(e) => {
                            const nextCost = parseFloat(e.target.value) || 0;
                            updatePurchaseItem(idx, {
                              unitCost: nextCost,
                              ...(item.isNew && (!item.salePrice || item.salePrice === Number((item.unitCost * 1.25).toFixed(2)))
                                ? { salePrice: Number((nextCost * 1.25).toFixed(2)) }
                                : {}),
                            });
                          }}
                          className="w-full h-10 px-2 text-xs border border-line bg-surface rounded-xl text-center font-black text-truffle dark:text-flame focus:outline-none focus:border-flame"
                        />
                      </div>

                      {item.isNew && (
                        <div className="col-span-4 sm:col-span-2">
                          <label className="text-[11px] font-bold text-success block mb-1">
                            سعر البيع (ج.م)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            placeholder="0.00"
                            value={item.salePrice || ''}
                            onChange={(e) =>
                              updatePurchaseItem(idx, { salePrice: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full h-10 px-2 text-xs border border-success-border bg-success-bg/40 rounded-xl text-center font-black text-success focus:outline-none focus:border-flame"
                          />
                        </div>
                      )}

                      <div className={item.isNew ? 'col-span-12 sm:col-span-1 text-center' : 'col-span-3 sm:col-span-1 text-center'}>
                        {purchaseData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePurchaseLine(idx)}
                            className="w-10 h-10 rounded-xl bg-danger-bg text-danger-text hover:bg-truffle hover:text-truffle-ink flex items-center justify-center font-bold transition-colors"
                            title="حذف هذا البند"
                          >
                            <Trash2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-left text-[11px] text-ink-muted font-bold pt-1 border-t border-divider">
                      إجمالي البند: {formatCurrency(item.quantity * (item.unitCost || 0))}
                    </div>
                  </m.div>
                ))}
              </AnimatePresence>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPurchaseLine}
                className="text-xs gap-1.5"
              >
                <Plus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                <span>+ إضافة صنف آخر بالفاتورة</span>
              </Button>
            </div>

            {/* إرفاق صورة فاتورة المورد */}
            <div className="p-3.5 bg-surface-alt rounded-2xl border border-line space-y-2">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-truffle dark:text-flame" />
                  <span>إرفاق صورة فاتورة المورد (كاميرا أو معرض):</span>
                </span>
                {purchaseData.invoicePhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setPurchaseData({ ...purchaseData, invoicePhotoUrl: null })}
                    className="text-xs text-danger-text hover:underline font-bold"
                  >
                    حذف الصورة
                  </button>
                )}
              </label>

              {purchaseData.invoicePhotoUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={purchaseData.invoicePhotoUrl}
                    alt="معاينة الصورة"
                    className="w-20 h-20 object-cover rounded-xl border border-line"
                  />
                  <div className="text-xs text-success font-bold flex items-center gap-1">
                    <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-success" />
                    <span>تم إرفاق صورة الفاتورة بنجاح</span>
                  </div>
                </div>
              ) : (
                <div className="relative border-2 border-dashed border-line hover:border-flame rounded-xl p-4 text-center cursor-pointer transition-colors bg-surface">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Camera strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-ink-muted" />
                    <p className="text-xs font-bold text-ink-strong">
                      اضغط لالتقاط صورة الفاتورة بالكاميرا أو اختيارها من المعرض
                    </p>
                    <p className="text-[10px] text-ink-muted">
                      تحفظ مع الفاتورة للرجوع إليها في أي وقت
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* الحسابات وطريقة السداد */}
            <div className="bg-surface-alt border border-line p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-ink-strong">
                <span>إجمالي الفاتورة المحسوب:</span>
                <span className="font-mono font-black text-base text-truffle dark:text-flame">
                  {formatCurrency(calculatedSubtotal)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-divider">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-ink">
                      المبلغ المسدد للمورد (ج.م) *
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPurchaseData({
                            ...purchaseData,
                            paidAmount: calculatedSubtotal,
                            isPaidAmountManual: true,
                          })
                        }
                        className="text-[10px] text-truffle dark:text-flame hover:underline font-bold"
                      >
                        سداد كامل
                      </button>
                      <span className="text-ink-muted">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPurchaseData({
                            ...purchaseData,
                            paidAmount: 0,
                            isPaidAmountManual: true,
                          })
                        }
                        className="text-[10px] text-ink-muted hover:underline"
                      >
                        آجل (0)
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchaseData.paidAmount}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        paidAmount: parseFloat(e.target.value) || 0,
                        isPaidAmountManual: true,
                      })
                    }
                    className="w-full h-11 px-3 text-sm border border-line rounded-xl font-black text-success bg-surface focus:outline-none focus:border-flame"
                  />
                  <p className="text-[10px] text-ink-muted mt-0.5">
                    يقترح النظام الإجمالي تلقائياً، ويمكنك كتابة أي مبلغ مسدد فعلياً
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">طريقة السداد</label>
                  <select
                    value={purchaseData.paymentMethod}
                    onChange={(e: any) =>
                      setPurchaseData({ ...purchaseData, paymentMethod: e.target.value })
                    }
                    className="w-full h-11 px-3 text-xs border border-line rounded-xl bg-surface text-ink-strong font-bold focus:outline-none focus:border-flame"
                  >
                    <option value="cash">نقدًا من الدرج (كاش يخصم من الوردية)</option>
                    <option value="wallet">محفظة إلكترونية</option>
                    <option value="instapay">إنستاباي</option>
                    <option value="credit">آجل بالكامل (على حساب المورد)</option>
                    <option value="bank">تحويل بنكي</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-black pt-2 border-t border-divider text-ink-strong">
                <span>المتبقي دين يسجل على حساب المورد:</span>
                <span className="font-mono text-sm text-danger-text">
                  {formatCurrency(Math.max(0, calculatedSubtotal - purchaseData.paidAmount))}
                </span>
              </div>
            </div>

            <Button type="submit" size="xl" variant="primary" saveState={purchaseSaveState} savedText="تم التوريد والحفظ" className="w-full font-bold shadow-accent">
              تأكيد وتوريد البضاعة للمخزن وحفظ الفاتورة
            </Button>
          </form>
        </Dialog>
      )}

      {/* نافذة سداد دفعة للمورد */}
      {isPaymentModalOpen && selectedSupplier && (
        <Dialog
          isOpen={true}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`تسجيل سداد دفعة للمورد: ${selectedSupplier.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleConfirmSupplierPayment} className="p-4 sm:p-5 space-y-4">
            <div className="bg-info-bg p-3 rounded-xl border border-info-border text-xs flex justify-between text-ink-strong">
              <span>إجمالي الرصيد المستحق للمورد حاليًا:</span>
              <span className="font-black text-truffle dark:text-flame text-sm">
                {formatCurrency(selectedSupplier.owedBalance)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                تاريخ السداد <span className="text-danger-text">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full h-11 px-3 text-sm border border-line rounded-xl font-bold bg-surface text-ink-strong focus:outline-none focus:border-flame"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                المبلغ المسدد (ج.م) <span className="text-danger-text">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-11 px-3 text-sm border border-line bg-surface rounded-xl font-black text-danger-text focus:outline-none focus:border-flame"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">طريقة الصرف والسداد</label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 text-xs border border-line rounded-xl bg-surface text-ink-strong font-bold focus:outline-none focus:border-flame"
              >
                <option value="cash">نقدًا من الدرج (يخصم من كاش الوردية الحالية)</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="instapay">إنستاباي</option>
                <option value="bank">تحويل بنكي</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">ملاحظات / رقم الإيصال</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="مثال: دفعة سداد تحت حساب توريد شواحن"
                className="w-full h-10 px-3 text-xs border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
              />
            </div>

            <Button type="submit" size="lg" variant="danger" className="w-full font-bold">
              تأكيد صرف وحفظ السداد في كشف الحساب
            </Button>
          </form>
        </Dialog>
      )}

      {/* نافذة تفاصيل فاتورة الشراء */}
      {viewingInvoice && (
        <Dialog
          isOpen={true}
          onClose={() => setViewingInvoice(null)}
          title={`تفاصيل فاتورة الشراء (${viewingInvoice.invoiceNumber})`}
          maxWidth="lg"
        >
          <div className="p-4 sm:p-6 space-y-5">
            <div className="bg-surface-alt p-4 rounded-2xl border border-line grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-ink-muted block mb-0.5">رقم الفاتورة:</span>
                <span className="font-mono font-black text-ink-strong text-sm">
                  {viewingInvoice.invoiceNumber}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block mb-0.5">المورد:</span>
                <span className="font-bold text-ink-strong text-sm">
                  {viewingInvoice.supplierName}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block mb-0.5">تاريخ التوريد:</span>
                <span className="font-bold text-ink">
                  {formatArabicDateTime(viewingInvoice.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block mb-0.5">طريقة السداد:</span>
                <Badge variant="default" className="text-xs">
                  {viewingInvoice.paymentMethod === 'cash'
                    ? 'كاش (من الدرج)'
                    : viewingInvoice.paymentMethod === 'wallet'
                    ? 'محفظة إلكترونية'
                    : viewingInvoice.paymentMethod === 'instapay'
                    ? 'إنستاباي'
                    : viewingInvoice.paymentMethod === 'credit'
                    ? 'آجل بالكامل'
                    : 'تحويل بنكي'}
                </Badge>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-ink mb-2">الأصناف الموردة بالفاتورة:</h4>
              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">اسم الصنف</th>
                      <th className="p-2.5 text-center">الكمية الموردة</th>
                      <th className="p-2.5 text-center">تكلفة الوحدة</th>
                      <th className="p-2.5 text-left">إجمالي البند</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider bg-surface">
                    {viewingInvoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-alt/50">
                        <td className="p-2.5 text-ink-muted font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-ink-strong">{item.productName}</td>
                        <td className="p-2.5 text-center font-bold text-ink font-mono">
                          {item.quantity}
                        </td>
                        <td className="p-2.5 text-center font-mono text-ink font-bold">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="p-2.5 text-left font-mono font-black text-truffle dark:text-flame">
                          {formatCurrency(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-surface-alt p-4 rounded-2xl border border-line space-y-2 text-xs">
              <div className="flex justify-between items-center text-ink">
                <span className="font-bold">إجمالي الفاتورة:</span>
                <span className="font-mono font-black text-base text-ink-strong">
                  {formatCurrency(viewingInvoice.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-success border-t border-divider pt-1.5">
                <span className="font-bold">المبلغ المسدد:</span>
                <span className="font-mono font-bold text-sm">
                  {formatCurrency(viewingInvoice.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-danger-text border-t border-divider pt-1.5 font-bold">
                <span>المتبقي دين على المحل للمورد:</span>
                <span className="font-mono font-black text-sm">
                  {formatCurrency(viewingInvoice.remainingAmount)}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-ink mb-2 flex items-center gap-1.5">
                <Camera strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-truffle dark:text-flame" />
                <span>صورة الفاتورة المرفقة:</span>
              </h4>
              {viewingInvoice.invoicePhotoUrl ? (
                <div className="border border-line rounded-2xl p-2 bg-surface-alt flex flex-col items-center">
                  <div
                    onClick={() => setEnlargedPhoto(viewingInvoice.invoicePhotoUrl || null)}
                    className="cursor-pointer group relative overflow-hidden rounded-xl border border-line max-h-64"
                  >
                    <img
                      src={viewingInvoice.invoicePhotoUrl}
                      alt="صورة فاتورة المورد"
                      className="w-full object-contain max-h-64 rounded-xl group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-abyssal/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-palladian text-xs font-bold transition-opacity">
                      انقر لتكبير الصورة
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed border-line rounded-xl text-center text-ink-muted text-xs">
                  لا توجد صورة مرفقة مع هذه الفاتورة.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-divider">
              <Button variant="outline" size="md" onClick={() => setViewingInvoice(null)}>
                إغلاق النافذة
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* نافذة تكبير الصورة */}
      {enlargedPhoto && (
        <Dialog
          isOpen={true}
          onClose={() => setEnlargedPhoto(null)}
          title="معاينة صورة فاتورة المورد"
          maxWidth="xl"
        >
          <div className="p-4 text-center">
            <img
              src={enlargedPhoto}
              alt="صورة الفاتورة بالحجم الكامل"
              className="max-h-[75vh] w-auto mx-auto rounded-xl border border-line shadow-card object-contain"
            />
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setEnlargedPhoto(null)}>
                إغلاق المعاينة
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* نافذة إضافة مورد جديد */}
      <Dialog
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        title="إضافة مورد جديد"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveSupplier} className="p-4 sm:p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              اسم المورد <span className="text-danger-text">*</span>
            </label>
            <Input
              type="text"
              required
              value={newSupplierData.name}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
              placeholder="مثال: م. حسام التوريدات"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">رقم الهاتف</label>
            <Input
              type="tel"
              dir="ltr"
              value={newSupplierData.phone}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, phone: e.target.value })}
              placeholder="01xxxxxxxxx"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              رصيد افتتاحي مستحق للمورد (إن وجد دين سابق)
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={newSupplierData.initialBalance || ''}
              onChange={(e) =>
                setNewSupplierData({
                  ...newSupplierData,
                  initialBalance: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0.00"
            />
          </div>

          <div className="pt-2 border-t border-divider flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsAddSupplierOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="md">
              حفظ المورد
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
