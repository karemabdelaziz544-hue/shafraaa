'use client';

import React, { useState } from 'react';
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
  Calendar,
  CheckCircle2,
  Trash2,
  X,
  ExternalLink,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useShop, Supplier, PurchaseInvoice, SupplierPayment } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatArabicDateTime } from '@/lib/formatters';

interface PurchaseLineFormItem {
  isNew: boolean;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
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
  } = useShop();

  const [activeTab, setActiveTab] = useState<'suppliers' | 'invoices'>('suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseInvoice | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  // كشف حساب المورد (الأستاذ المساعد)
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // سداد دفعة مورد
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'instapay' | 'bank'>('cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  // نموذج إضافة مورد جديد (الاسم ورقم الهاتف)
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    phone: '',
    initialBalance: 0,
  });

  // فاتورة توريد جديدة (تدعم اختيار صنف أو كتابة صنف جديد يدويًا)
  const [purchaseData, setPurchaseData] = useState<{
    items: PurchaseLineFormItem[];
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'bank';
    paidAmount: number;
    isPaidAmountManual: boolean;
    notes: string;
    invoicePhotoUrl: string | null;
  }>({
    items: [{ isNew: false, productId: '', productName: '', quantity: 1, unitCost: 0 }],
    paymentMethod: 'cash',
    paidAmount: 0,
    isPaidAmountManual: false,
    notes: '',
    invoicePhotoUrl: null,
  });

  // حساب إجمالي الفاتورة لحظياً
  const calculatedSubtotal = purchaseData.items.reduce(
    (sum, item) => sum + (item.quantity * (item.unitCost || 0)),
    0
  );

  // تحديث بنود الفاتورة واقتراح المدفوع تلقائياً ما لم يقم المستخدم بتعديله يدويًا
  const updatePurchaseItem = (idx: number, updates: Partial<PurchaseLineFormItem>) => {
    const newItems = [...purchaseData.items];
    newItems[idx] = { ...newItems[idx], ...updates };

    const newSubtotal = newItems.reduce(
      (sum, item) => sum + (item.quantity * (item.unitCost || 0)),
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
        { isNew: false, productId: '', productName: '', quantity: 1, unitCost: 0 },
      ],
    }));
  };

  const removePurchaseLine = (idx: number) => {
    const newItems = purchaseData.items.filter((_, i) => i !== idx);
    const newSubtotal = newItems.reduce(
      (sum, item) => sum + (item.quantity * (item.unitCost || 0)),
      0
    );
    setPurchaseData((prev) => ({
      ...prev,
      items: newItems,
      paidAmount: prev.isPaidAmountManual ? prev.paidAmount : newSubtotal,
    }));
  };

  // معالجة رفع صورة الفاتورة (كاميرا أو معرض)
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

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierData.name.trim()) return;

    addSupplier({
      name: newSupplierData.name.trim(),
      phone: newSupplierData.phone.trim(),
      initialBalance: newSupplierData.initialBalance,
      notes: '',
    });

    setIsAddSupplierOpen(false);
    setNewSupplierData({ name: '', phone: '', initialBalance: 0 });
  };

  // تأكيد سداد دفعة للمورد مع التاريخ
  const handleConfirmSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) return;

    addSupplierPayment({
      supplierId: selectedSupplier.id,
      amount: amt,
      method: paymentMethod,
      date: paymentDate,
      notes: paymentNotes,
    });

    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    const validItems = purchaseData.items.filter(
      (i) => (i.productId || i.productName.trim()) && i.quantity > 0
    );
    if (validItems.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل بالفاتورة مع تحديد الكمية والتكلفة.');
      return;
    }

    createPurchaseInvoice({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      items: validItems.map((item) => ({
        isNew: item.isNew,
        productId: item.isNew ? undefined : item.productId,
        productName: item.isNew ? item.productName : undefined,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
      paymentMethod: purchaseData.paymentMethod,
      paidAmount: purchaseData.paidAmount,
      invoicePhotoUrl: purchaseData.invoicePhotoUrl,
      notes: purchaseData.notes,
    });

    setIsPurchaseModalOpen(false);
    setPurchaseData({
      items: [{ isNew: false, productId: '', productName: '', quantity: 1, unitCost: 0 }],
      paymentMethod: 'cash',
      paidAmount: 0,
      isPaidAmountManual: false,
      notes: '',
      invoicePhotoUrl: null,
    });
  };

  // فتح نافذة فاتورة شراء لمورد
  const openPurchaseModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setPurchaseData({
      items: [{ isNew: false, productId: '', productName: '', quantity: 1, unitCost: 0 }],
      paymentMethod: 'cash',
      paidAmount: 0,
      isPaidAmountManual: false,
      notes: '',
      invoicePhotoUrl: null,
    });
    setIsPurchaseModalOpen(true);
  };

  // فتح نافذة سداد دفعة
  const openPaymentModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setPaymentAmount(s.owedBalance > 0 ? String(s.owedBalance) : '');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  // تجهيز كشف حساب الأستاذ العام للمورد المحدد (Ledger with Running Balance)
  const getSupplierLedger = (supplierId: string) => {
    interface LedgerEntry {
      id: string;
      date: string;
      type: 'INVOICE' | 'PAYMENT';
      title: string;
      reference: string;
      method?: string;
      debitOwed: number; // مشتريات تزيد الدين
      creditPaid: number; // مسددات تنقص الدين
      notes?: string;
    }

    const entries: LedgerEntry[] = [];

    // 1. فواتير الشراء والتوريد لهذا المورد
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

    // 2. مدفوعات المورد (سداد دفعات)
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

    // الترتيب الزمني من الأقدم إلى الأحدث لحساب الرصيد التراكمي
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const ledgerWithBalance = entries.map((entry) => {
      runningBalance = runningBalance + entry.debitOwed - entry.creditPaid;
      return {
        ...entry,
        runningBalance: Number(runningBalance.toFixed(2)),
      };
    });

    // عكس الترتيب لعرض الأحدث في الأعلى
    return ledgerWithBalance.reverse();
  };

  return (
    <div className="space-y-5">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-brand-600" />
            <span>الموردين وفواتير الشراء وكشف الحساب</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - تسجيل فواتير التوريد (أصناف قديمة أو جديدة) وكشف حساب تفصيلي لكل مورد وسداد الدفعات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" onClick={() => setIsAddSupplierOpen(true)}>
            <Plus className="w-4 h-4 ml-1" />
            <span>إضافة مورد جديد</span>
          </Button>
        </div>
      </div>

      {/* التبديل بين التبويبات */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'suppliers'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>الموردين وكشوف الحساب ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'invoices'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>سجل فواتير الشراء والتوريد ({purchaseInvoices.length})</span>
        </button>
      </div>

      {/* شريط البحث */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3" />
        <input
          type="text"
          placeholder={
            activeTab === 'suppliers'
              ? 'ابحث باسم المورد أو رقم الهاتف...'
              : 'ابحث برقم الفاتورة أو اسم المورد...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pr-11 pl-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {/* التبويب 1: جدول الموردين وكشوف الحساب */}
      {activeTab === 'suppliers' && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {filteredSuppliers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                لا يوجد موردين مطابقين للبحث.
              </div>
            ) : (
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 sm:p-4">اسم المورد</th>
                    <th className="p-3 sm:p-4">رقم الهاتف</th>
                    <th className="p-3 sm:p-4">المستحق للمورد (دين علينا)</th>
                    <th className="p-3 sm:p-4 text-center">إجراءات المورد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 sm:p-4">
                        <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-slate-600">
                        {s.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{s.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">غير مسجل</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-black">
                        {s.owedBalance > 0 ? (
                          <span className="text-rose-600 font-bold text-sm">
                            {formatCurrency(s.owedBalance)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">خالص (0.00 ج.م)</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* زر كشف الحساب */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLedgerSupplier(s)}
                            className="text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>كشف الحساب</span>
                          </Button>

                          {/* زر فاتورة توريد */}
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openPurchaseModal(s)}
                            className="bg-brand-600 hover:bg-brand-700 text-xs gap-1"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>فاتورة توريد</span>
                          </Button>

                          {/* زر سداد دفعة */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPaymentModal(s)}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-bold gap-1"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
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

      {/* التبويب 2: سجل فواتير الشراء والتوريد التفصيلي */}
      {activeTab === 'invoices' && (
        <Card>
          <CardHeader className="py-3 bg-slate-50 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>جميع فواتير الشراء والتوريد المسجلة ({filteredInvoices.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                لا توجد فواتير شراء وتوريد مسجلة حتى الآن.
              </div>
            ) : (
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 sm:p-4 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="p-3 sm:p-4 font-bold text-slate-800">
                        {inv.supplierName}
                      </td>
                      <td className="p-3 sm:p-4 text-slate-500 text-[11px]">
                        {formatArabicDateTime(inv.createdAt)}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-black text-slate-900">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-emerald-600 font-bold">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-bold">
                        {inv.remainingAmount > 0 ? (
                          <span className="text-rose-600 font-bold">
                            {formatCurrency(inv.remainingAmount)}
                          </span>
                        ) : (
                          <span className="text-emerald-600">مسدد بالكامل</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        {inv.invoicePhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setEnlargedPhoto(inv.invoicePhotoUrl || null)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>مرفقة</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">بدون صورة</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingInvoice(inv)}
                          className="text-xs gap-1 border-brand-200 text-brand-700 hover:bg-brand-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

      {/* نافذة كشف حساب المورد التفصيلي (Ledger History & Running Balance) */}
      {ledgerSupplier && (
        <Dialog
          isOpen={true}
          onClose={() => setLedgerSupplier(null)}
          title={`كشف حساب الأستاذ العام للمورد: ${ledgerSupplier.name}`}
          maxWidth="2xl"
        >
          <div className="p-4 sm:p-6 space-y-5">
            {/* بطاقات ملخص حساب المورد */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-xs text-slate-500 block mb-0.5">رقم الهاتف:</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {ledgerSupplier.phone || 'غير مسجل'}
                </span>
              </div>

              <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200">
                <span className="text-xs text-rose-700 block mb-0.5">الرصيد المتبقي مستحق للمورد (دين):</span>
                <span className="font-mono font-black text-rose-700 text-lg">
                  {formatCurrency(ledgerSupplier.owedBalance)}
                </span>
              </div>

              <div className="flex items-center justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => openPaymentModal(ledgerSupplier)}
                  className="w-full gap-1.5 font-bold shadow-md shadow-brand-500/20"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>تسجيل سداد دفعة للمورد</span>
                </Button>
              </div>
            </div>

            {/* جدول حركات كشف الحساب المتسلسل مع الرصيد التراكمي */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">
                سجل الحركات المالية المتبادلة (فواتير التوريد وسدادات الدفعات):
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b sticky top-0">
                    <tr>
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5">نوع الحركة</th>
                      <th className="p-2.5">البيان / طريقة السداد</th>
                      <th className="p-2.5 text-center text-rose-700">مستحق للمورد (+)</th>
                      <th className="p-2.5 text-center text-emerald-700">مسدد للمورد (-)</th>
                      <th className="p-2.5 text-left font-black">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {getSupplierLedger(ledgerSupplier.id).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          لا توجد حركات مسجلة لهذا المورد حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      getSupplierLedger(ledgerSupplier.id).map((row) => (
                        <tr
                          key={row.id}
                          className={
                            row.type === 'PAYMENT'
                              ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="p-2.5 font-mono text-slate-600 text-[11px]">
                            {row.date.split('T')[0]}
                          </td>
                          <td className="p-2.5 font-bold">
                            {row.type === 'INVOICE' ? (
                              <Badge variant="purple" className="text-[10px]">
                                توريد بضاعة
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                سداد دفعة
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-800">
                            <span className="font-semibold block">{row.title}</span>
                            {row.method && (
                              <span className="text-[10px] text-slate-400">
                                طريقة: {row.method === 'cash' ? 'كاش' : row.method === 'wallet' ? 'محفظة' : row.method === 'instapay' ? 'إنستاباي' : 'آجل/تحويل'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-rose-600">
                            {row.debitOwed > 0 ? `+${formatCurrency(row.debitOwed)}` : '-'}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-600">
                            {row.creditPaid > 0 ? `-${formatCurrency(row.creditPaid)}` : '-'}
                          </td>
                          <td className="p-2.5 text-left font-mono font-black text-slate-900">
                            {formatCurrency(row.runningBalance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" size="md" onClick={() => setLedgerSupplier(null)}>
                إغلاق كشف الحساب
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* نافذة تسجيل فاتورة شراء وتوريد بضاعة (صنف موجود أو كتابة صنف جديد) */}
      {isPurchaseModalOpen && selectedSupplier && (
        <Dialog
          isOpen={true}
          onClose={() => setIsPurchaseModalOpen(false)}
          title={`تسجيل فاتورة توريد من: ${selectedSupplier.name}`}
          maxWidth="xl"
        >
          <form onSubmit={handleCreatePurchase} className="p-4 sm:p-6 space-y-5">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
              <span>
                أهلًا يا كريم: يمكنك اختيار صنف موجود من الكتالوج أو كتابة اسم صنف جديد باليد وسيتم إنشاؤه في النظام تلقائياً وتوليد باركوده فوراً!
              </span>
            </div>

            {/* بنود الفاتورة */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 block">بنود الفاتورة الموردة:</label>

              {purchaseData.items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                    <span className="text-xs font-bold text-slate-600">بند #{idx + 1}</span>

                    {/* التبديل بين صنف موجود أو صنف جديد باليد */}
                    <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 text-xs">
                      <button
                        type="button"
                        onClick={() => updatePurchaseItem(idx, { isNew: false, productName: '' })}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          !item.isNew
                            ? 'bg-brand-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        صنف من الكتالوج
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePurchaseItem(idx, { isNew: true, productId: '' })}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          item.isNew
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        ✨ صنف جديد (كتابة يدوية)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2.5 items-end">
                    {/* حقل الصنف */}
                    <div className="col-span-12 sm:col-span-6">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {item.isNew ? 'اسم الصنف الجديد *' : 'اختر الصنف من الكتالوج *'}
                      </label>
                      {item.isNew ? (
                        <input
                          type="text"
                          required
                          placeholder="اكتب اسم الصنف الجديد هنا (مثال: ريموت سيارة كيا كود 4)..."
                          value={item.productName}
                          onChange={(e) => updatePurchaseItem(idx, { productName: e.target.value })}
                          className="w-full h-10 px-3 text-xs border border-purple-300 rounded-xl bg-purple-50/20 font-bold focus:outline-none focus:border-purple-500"
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
                          className="w-full h-10 px-3 text-xs border border-slate-300 rounded-xl bg-white font-bold"
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

                    {/* الكمية */}
                    <div className="col-span-4 sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) =>
                          updatePurchaseItem(idx, { quantity: parseInt(e.target.value) || 1 })
                        }
                        className="w-full h-10 px-2 text-xs border rounded-xl text-center font-bold"
                      />
                    </div>

                    {/* تكلفة الوحدة */}
                    <div className="col-span-5 sm:col-span-3">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        سعر التكلفة للقطعة (ج.م)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="0.00"
                        value={item.unitCost || ''}
                        onChange={(e) =>
                          updatePurchaseItem(idx, { unitCost: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full h-10 px-2 text-xs border rounded-xl text-center font-black text-brand-700"
                      />
                    </div>

                    {/* حذف البند */}
                    <div className="col-span-3 sm:col-span-1 text-center">
                      {purchaseData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePurchaseLine(idx)}
                          className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center font-bold"
                          title="حذف هذا البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-left text-[11px] text-slate-500 font-bold pt-1 border-t border-slate-200/50">
                    إجمالي البند: {formatCurrency(item.quantity * (item.unitCost || 0))}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPurchaseLine}
                className="text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ إضافة صنف آخر بالفاتورة</span>
              </Button>
            </div>

            {/* إرفاق صورة فاتورة المورد (كاميرا أو معرض) */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-brand-600" />
                  <span>إرفاق صورة فاتورة المورد (كاميرا أو معرض):</span>
                </span>
                {purchaseData.invoicePhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setPurchaseData({ ...purchaseData, invoicePhotoUrl: null })}
                    className="text-xs text-rose-600 hover:underline font-bold"
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
                    className="w-20 h-20 object-cover rounded-xl border border-slate-300"
                  />
                  <div className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم إرفاق صورة الفاتورة بنجاح</span>
                  </div>
                </div>
              ) : (
                <div className="relative border-2 border-dashed border-slate-300 hover:border-brand-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-white">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Camera className="w-6 h-6 text-slate-400" />
                    <p className="text-xs font-bold text-slate-700">
                      اضغط لالتقاط صورة الفاتورة بالكاميرا أو اختيارها من المعرض
                    </p>
                    <p className="text-[10px] text-slate-400">
                      تحفظ مع الفاتورة للرجوع إليها في أي وقت
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* الحسابات والمبلغ المدفوع المقترح والحر وطريقة السداد */}
            <div className="bg-slate-100 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                <span>إجمالي الفاتورة المحسوب:</span>
                <span className="font-mono font-black text-base text-brand-700">
                  {formatCurrency(calculatedSubtotal)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
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
                        className="text-[10px] text-brand-700 hover:underline font-bold"
                      >
                        سداد كامل
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPurchaseData({
                            ...purchaseData,
                            paidAmount: 0,
                            isPaidAmountManual: true,
                          })
                        }
                        className="text-[10px] text-slate-500 hover:underline"
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
                    className="w-full h-11 px-3 text-sm border border-slate-300 rounded-xl font-black text-emerald-700 bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    يقترح النظام الإجمالي تلقائياً، ويمكنك كتابة أي مبلغ مسدد فعلياً
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">طريقة السداد</label>
                  <select
                    value={purchaseData.paymentMethod}
                    onChange={(e: any) =>
                      setPurchaseData({ ...purchaseData, paymentMethod: e.target.value })
                    }
                    className="w-full h-11 px-3 text-xs border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    <option value="cash">نقدًا من الدرج (كاش يخصم من الوردية)</option>
                    <option value="wallet">محفظة إلكترونية</option>
                    <option value="instapay">إنستاباي</option>
                    <option value="credit">آجل بالكامل (على حساب المورد)</option>
                    <option value="bank">تحويل بنكي</option>
                  </select>
                </div>
              </div>

              {/* المتبقي دين للمورد */}
              <div className="flex justify-between items-center text-xs font-black pt-2 border-t border-slate-200">
                <span>المتبقي دين يسجل على حساب المورد:</span>
                <span className="font-mono text-sm text-rose-600">
                  {formatCurrency(Math.max(0, calculatedSubtotal - purchaseData.paidAmount))}
                </span>
              </div>
            </div>

            <Button type="submit" size="xl" variant="primary" className="w-full font-bold shadow-lg shadow-brand-500/25">
              تأكيد وتوريد البضاعة للمخزن وحفظ الفاتورة
            </Button>
          </form>
        </Dialog>
      )}

      {/* نافذة سداد دفعة للمورد مع التاريخ المحدد وطريقة الدفع */}
      {isPaymentModalOpen && selectedSupplier && (
        <Dialog
          isOpen={true}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`تسجيل سداد دفعة للمورد: ${selectedSupplier.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleConfirmSupplierPayment} className="p-4 sm:p-5 space-y-4">
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs flex justify-between">
              <span>إجمالي الرصيد المستحق للمورد حاليًا:</span>
              <span className="font-black text-blue-700 text-sm">
                {formatCurrency(selectedSupplier.owedBalance)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                تاريخ السداد <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full h-11 px-3 text-sm border rounded-xl font-bold bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                المبلغ المسدد (ج.م) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-11 px-3 text-sm border rounded-xl font-black text-rose-700"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">طريقة الصرف والسداد</label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 text-xs border rounded-xl bg-white font-bold"
              >
                <option value="cash">نقدًا من الدرج (يخصم من كاش الوردية الحالية)</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="instapay">إنستاباي</option>
                <option value="bank">تحويل بنكي</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات / رقم الإيصال</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="مثال: دفعة سداد تحت حساب توريد شواحن"
                className="w-full h-10 px-3 text-xs border rounded-xl"
              />
            </div>

            <Button type="submit" size="lg" variant="danger" className="w-full font-bold shadow-md shadow-rose-500/20">
              تأكيد صرف وحفظ السداد في كشف الحساب
            </Button>
          </form>
        </Dialog>
      )}

      {/* نافذة تفاصيل فاتورة الشراء بالكامل */}
      {viewingInvoice && (
        <Dialog
          isOpen={true}
          onClose={() => setViewingInvoice(null)}
          title={`تفاصيل فاتورة الشراء (${viewingInvoice.invoiceNumber})`}
          maxWidth="lg"
        >
          <div className="p-4 sm:p-6 space-y-5">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">رقم الفاتورة:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {viewingInvoice.invoiceNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">المورد:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {viewingInvoice.supplierName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">تاريخ التوريد:</span>
                <span className="font-bold text-slate-700">
                  {formatArabicDateTime(viewingInvoice.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">طريقة السداد:</span>
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

            {/* جدول بنود الفاتورة */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">الأصناف الموردة بالفاتورة:</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">اسم الصنف</th>
                      <th className="p-2.5 text-center">الكمية الموردة</th>
                      <th className="p-2.5 text-center">تكلفة الوحدة</th>
                      <th className="p-2.5 text-left">إجمالي البند</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {viewingInvoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900">{item.productName}</td>
                        <td className="p-2.5 text-center font-bold text-slate-800 font-mono">
                          {item.quantity}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-700 font-bold">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="p-2.5 text-left font-mono font-black text-brand-700">
                          {formatCurrency(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ملخص المبالغ */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-bold">إجمالي الفاتورة:</span>
                <span className="font-mono font-black text-base text-slate-900">
                  {formatCurrency(viewingInvoice.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-emerald-700 border-t pt-1.5">
                <span className="font-bold">المبلغ المسدد:</span>
                <span className="font-mono font-bold text-sm">
                  {formatCurrency(viewingInvoice.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-rose-700 border-t pt-1.5 font-bold">
                <span>المتبقي دين على المحل للمورد:</span>
                <span className="font-mono font-black text-sm">
                  {formatCurrency(viewingInvoice.remainingAmount)}
                </span>
              </div>
            </div>

            {/* عرض صورة فاتورة المورد المرفقة */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-brand-600" />
                <span>صورة الفاتورة المرفقة:</span>
              </h4>
              {viewingInvoice.invoicePhotoUrl ? (
                <div className="border border-slate-200 rounded-2xl p-2 bg-slate-50 flex flex-col items-center">
                  <div
                    onClick={() => setEnlargedPhoto(viewingInvoice.invoicePhotoUrl || null)}
                    className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-200 max-h-64"
                  >
                    <img
                      src={viewingInvoice.invoicePhotoUrl}
                      alt="صورة فاتورة المورد"
                      className="w-full object-contain max-h-64 rounded-xl group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                      انقر لتكبير الصورة
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-slate-400 text-xs">
                  لا توجد صورة مرفقة مع هذه الفاتورة.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" size="md" onClick={() => setViewingInvoice(null)}>
                إغلاق النافذة
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* نافذة تكبير الصورة بالحجم الكامل */}
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
              className="max-h-[75vh] w-auto mx-auto rounded-xl border shadow-md object-contain"
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
            <label className="text-xs font-bold text-slate-700 block mb-1">
              اسم المورد <span className="text-rose-500">*</span>
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
            <label className="text-xs font-bold text-slate-700 block mb-1">رقم الهاتف</label>
            <Input
              type="tel"
              dir="ltr"
              value={newSupplierData.phone}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, phone: e.target.value })}
              placeholder="01xxxxxxxxx"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
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

          <div className="pt-2 border-t flex justify-end gap-2">
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
