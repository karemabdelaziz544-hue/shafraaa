'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  calculateInvoiceTotals,
  calculateStockLevel,
  calculateDrawerExpectedCash,
  calculatePeriodNetProfit,
  checkCustomerCreditLimit,
} from '@/lib/calculations';
import { generateUniqueBarcode } from '@/lib/barcode-generator';
import { createClient } from '@/lib/supabase/client';
import {
  generateUuid,
  loadShopDataFromSupabase,
  uploadInvoicePhotoToStorage,
} from '@/lib/supabase/shop-sync';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  extraCost: number;
  salePrice: number;
  openingStock: number;
  currentStock: number;
  minStockAlert: number;
  unit: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  currentBalance: number; // دين على العميل
  notes?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone: string;
  owedBalance: number; // مستحق للمورد
  notes?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod: 'cash' | 'wallet' | 'instapay' | 'bank' | 'credit';
  paymentDate: string; // YYYY-MM-DD
  notes?: string;
  drawerSessionId?: string | null;
  createdAt: string;
}

export interface DamagedItem {
  id: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitCost: number;
  totalLoss: number; // quantity * unitCost
  reason: string;
  notes?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface SaleInvoiceItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  lineCost: number;
  lineProfit: number;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName: string;
  items: SaleInvoiceItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'split';
  drawerSessionId?: string | null;
  notes?: string;
  status: 'completed' | 'returned_partial' | 'returned_full' | 'cancelled';
  createdAt: string;
  deletedAt?: string | null;
}

export interface PurchaseInvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId?: string | null;
  supplierName: string;
  items: PurchaseInvoiceItem[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'bank';
  drawerSessionId?: string | null;
  notes?: string;
  invoicePhotoUrl?: string | null;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Expense {
  id: string;
  type: 'fixed' | 'variable';
  category: string;
  amount: number;
  paymentMethod: 'cash' | 'wallet' | 'instapay' | 'bank';
  date: string;
  notes?: string;
  drawerSessionId?: string | null;
  createdAt: string;
  deletedAt?: string | null;
}

export interface OwnerWithdrawal {
  id: string;
  ownerName: string;
  amount: number;
  paymentMethod: 'cash' | 'wallet' | 'instapay';
  date: string;
  reason: string;
  drawerSessionId?: string | null;
  createdAt: string;
  deletedAt?: string | null;
}

export interface PhysicalCountItem {
  id: string;
  productId: string;
  productName: string;
  systemStock: number;
  countedStock: number;
  variance: number;
  unitCost: number;
  varianceCost: number;
}

export interface PhysicalCount {
  id: string;
  countNumber: number;
  countDate: string;
  status: 'draft' | 'approved' | 'rejected';
  items: PhysicalCountItem[];
  totalVarianceCost: number;
  notes?: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt: string;
}

export interface DrawerSession {
  id: string;
  sessionNumber: number;
  openedAt: string;
  closedAt?: string | null;
  status: 'open' | 'closed';
  openingCash: number;
  cashSales: number;
  cashReturns: number;
  cashDebtPayments: number;
  cashSupplierPayments: number;
  cashExpenses: number;
  cashWithdrawals: number;
  expectedCash: number;
  actualCash?: number | null;
  difference?: number | null;
  walletTotal: number;
  instapayTotal: number;
  closingNotes?: string;
  reopenedAt?: string | null;
  reopenedBy?: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  tableName: string;
  details: string;
  createdAt: string;
}

interface ShopContextType {
  shopId: string | null;
  shopName: string;
  ownerName: string;
  userEmail: string | null;
  userRole: string;
  isSupabaseConfigured: boolean;
  isAuthChecking: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  damagedItems: DamagedItem[];
  salesInvoices: SaleInvoice[];
  purchaseInvoices: PurchaseInvoice[];
  expenses: Expense[];
  ownerWithdrawals: OwnerWithdrawal[];
  physicalCounts: PhysicalCount[];
  drawerSessions: DrawerSession[];
  activeDrawer: DrawerSession | null;
  auditLogs: AuditLog[];
  
  // Actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'currentStock'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'currentBalance'> & { initialBalance?: number }) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  addCustomerPayment: (customerId: string, amount: number, method: 'cash' | 'wallet' | 'instapay', notes?: string) => void;
  
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'owedBalance'> & { initialBalance?: number }) => Supplier;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  addSupplierPayment: (
    supplierIdOrData:
      | string
      | {
          supplierId: string;
          amount: number;
          method: 'cash' | 'wallet' | 'instapay' | 'bank';
          date?: string;
          notes?: string;
        },
    amount?: number,
    method?: 'cash' | 'wallet' | 'instapay' | 'bank',
    notes?: string
  ) => void;
  
  createSaleInvoice: (data: {
    customerId?: string | null;
    customerName?: string;
    items: Array<{ productId: string; quantity: number; unitPrice?: number; discount?: number }>;
    overallDiscount?: number;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'split';
    paidAmount: number;
    notes?: string;
  }) => { invoice: SaleInvoice; warning?: string };

  createSaleReturn: (data: {
    invoiceId?: string;
    productId: string;
    quantity: number;
    refundAmount: number;
    refundMethod: 'cash' | 'wallet' | 'instapay' | 'credit';
    isSellable: boolean;
    reason: string;
  }) => void;

  createPurchaseInvoice: (data: {
    supplierId?: string | null;
    supplierName: string;
    items: Array<{
      productId?: string;
      productName?: string;
      isNew?: boolean;
      quantity: number;
      unitCost: number;
    }>;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'bank';
    paidAmount: number;
    invoicePhotoUrl?: string | null;
    notes?: string;
  }) => void;

  addDamagedItem: (data: {
    productId?: string | null;
    productName?: string;
    quantity: number;
    unitCost?: number;
    reason: string;
    date?: string;
    notes?: string;
  }) => void;

  addExpense: (data: Omit<Expense, 'id' | 'createdAt'>) => void;
  addOwnerWithdrawal: (data: Omit<OwnerWithdrawal, 'id' | 'createdAt' | 'ownerName'>) => void;
  
  savePhysicalCountDraft: (items: Array<{ productId: string; countedStock: number }>, notes?: string) => string;
  approvePhysicalCount: (countId: string) => void;
  
  openNewDrawerSession: (openingCash: number) => void;
  closeDrawerSession: (actualCash: number, closingNotes?: string) => void;
  reopenDrawerSession: (sessionId?: string) => void;
  
  importDataFromExcel: (type: string, data: any[]) => void;
  exportDatabaseJSON: () => string;
  restoreDatabaseJSON: (json: string) => boolean;
  resetToSampleData: () => void;
}

const STORAGE_KEY = 'shafraaa_store_v1';

const defaultDrawer: DrawerSession = {
  id: 'drawer-default-1',
  sessionNumber: 1,
  openedAt: new Date().toISOString(),
  status: 'open',
  openingCash: 500,
  cashSales: 0,
  cashReturns: 0,
  cashDebtPayments: 0,
  cashSupplierPayments: 0,
  cashExpenses: 0,
  cashWithdrawals: 0,
  expectedCash: 500,
  actualCash: null,
  difference: null,
  walletTotal: 0,
  instapayTotal: 0,
};

const defaultProducts: Product[] = [
  {
    id: 'prod-1',
    name: 'شاحن سامسونج أصلي 25W سريع',
    barcode: '6221001001',
    category: 'إلكترونيات',
    costPrice: 180,
    extraCost: 5,
    salePrice: 260,
    openingStock: 25,
    currentStock: 22,
    minStockAlert: 5,
    unit: 'قطعة',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    name: 'سماعة بلوتوث لاسلكية Pro',
    barcode: '6221001002',
    category: 'إلكترونيات',
    costPrice: 120,
    extraCost: 0,
    salePrice: 195,
    openingStock: 15,
    currentStock: 14,
    minStockAlert: 4,
    unit: 'قطعة',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    name: 'كابل شحن تايب سي قماش مصفح 1.2M',
    barcode: '6221001003',
    category: 'كابلات',
    costPrice: 25,
    extraCost: 2,
    salePrice: 55,
    openingStock: 50,
    currentStock: 46,
    minStockAlert: 10,
    unit: 'قطعة',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-4',
    name: 'جراب سيليكون شفاف مقاوم للصدمات',
    barcode: '6221001004',
    category: 'إكسسوارات',
    costPrice: 15,
    extraCost: 0,
    salePrice: 40,
    openingStock: 30,
    currentStock: 3, // منخفض لتحفيز التنبيه
    minStockAlert: 5,
    unit: 'قطعة',
    createdAt: new Date().toISOString(),
  },
];

const defaultCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'أحمد محمود (المهندس)',
    phone: '01012345678',
    creditLimit: 1500,
    currentBalance: 1650, // تجاوز حد الائتمان لتحفيز التنبيه
    notes: 'عميل دائم',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cust-2',
    name: 'محمد عبد الله',
    phone: '01123456789',
    creditLimit: 800,
    currentBalance: 300,
    notes: '',
    createdAt: new Date().toISOString(),
  },
];

const defaultSuppliers: Supplier[] = [
  {
    id: 'supp-1',
    name: 'شركة النور للإلكترونيات والتوريد',
    company: 'النور تيك',
    phone: '01223344556',
    owedBalance: 4200,
    notes: 'مستحق فاتورة شواحن',
    createdAt: new Date().toISOString(),
  },
];

const defaultSupplierPayments: SupplierPayment[] = [
  {
    id: 'spay-1',
    supplierId: 'supp-1',
    supplierName: 'شركة النور للإلكترونيات والتوريد',
    amount: 1500,
    paymentMethod: 'cash',
    paymentDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    notes: 'سداد دفعة نقدية تحت حساب توريد شواحن',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

const defaultDamagedItems: DamagedItem[] = [
  {
    id: 'dmg-1',
    productId: 'prod-3',
    productName: 'كابل شحن تايب سي قماش مصفح 1.2M',
    quantity: 2,
    unitCost: 27,
    totalLoss: 54,
    reason: 'قطع داخلي في السلك أثناء التجربة',
    notes: 'هالك وتالف نهائي لا يصلح للبيع',
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const isSupabaseConfigured = Boolean(supabase);

  const [shopId, setShopId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('owner');
  const [shopName, setShopName] = useState('محل شفرة');
  const [ownerName, setOwnerName] = useState('كريم');
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(Boolean(supabase));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!supabase);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [damagedItems, setDamagedItems] = useState<DamagedItem[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SaleInvoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ownerWithdrawals, setOwnerWithdrawals] = useState<OwnerWithdrawal[]>([]);
  const [physicalCounts, setPhysicalCounts] = useState<PhysicalCount[]>([]);
  const [drawerSessions, setDrawerSessions] = useState<DrawerSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const clearShopState = useCallback(() => {
    setShopId(null);
    setProducts([]);
    setCustomers([]);
    setSuppliers([]);
    setSupplierPayments([]);
    setDamagedItems([]);
    setSalesInvoices([]);
    setPurchaseInvoices([]);
    setExpenses([]);
    setOwnerWithdrawals([]);
    setPhysicalCounts([]);
    setDrawerSessions([]);
    setAuditLogs([]);
  }, []);

  const hydrateFromSupabase = useCallback(
    async (uid: string, email?: string | null) => {
      if (!supabase) return;
      setIsAuthChecking(true);
      try {
        const payload = await loadShopDataFromSupabase(supabase, uid);
        if (payload) {
          setShopId(payload.shopId);
          setShopName(payload.shopName);
          setOwnerName(payload.ownerName);
          setUserRole(payload.userRole);
          setUserEmail(email || null);
          setProducts(payload.products);
          setCustomers(payload.customers);
          setSuppliers(payload.suppliers);
          setSupplierPayments(payload.supplierPayments);
          setDamagedItems(payload.damagedItems);
          setSalesInvoices(payload.salesInvoices);
          setPurchaseInvoices(payload.purchaseInvoices);
          setExpenses(payload.expenses);
          setOwnerWithdrawals(payload.ownerWithdrawals);
          setPhysicalCounts(payload.physicalCounts);
          setDrawerSessions(payload.drawerSessions);
          setAuditLogs(payload.auditLogs);
        }
      } finally {
        setIsLoaded(true);
        setIsAuthChecking(false);
      }
    },
    [supabase]
  );

  // التحقق من جلسة Supabase وتحميل بيانات المتجر المعزول أو الرجوع للتخزين المحلي في وضع التطوير غير المتصل
  useEffect(() => {
    if (!supabase) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setProducts(parsed.products || defaultProducts);
          setCustomers(parsed.customers || defaultCustomers);
          setSuppliers(parsed.suppliers || defaultSuppliers);
          setSupplierPayments(parsed.supplierPayments || defaultSupplierPayments);
          setDamagedItems(parsed.damagedItems || defaultDamagedItems);
          setSalesInvoices(parsed.salesInvoices || []);
          setPurchaseInvoices(parsed.purchaseInvoices || []);
          setExpenses(parsed.expenses || []);
          setOwnerWithdrawals(parsed.ownerWithdrawals || []);
          setPhysicalCounts(parsed.physicalCounts || []);
          setDrawerSessions(parsed.drawerSessions || [defaultDrawer]);
          setAuditLogs(parsed.auditLogs || []);
        } else {
          setProducts(defaultProducts);
          setCustomers(defaultCustomers);
          setSuppliers(defaultSuppliers);
          setSupplierPayments(defaultSupplierPayments);
          setDamagedItems(defaultDamagedItems);
          setDrawerSessions([defaultDrawer]);
          setAuditLogs([
            {
              id: 'log-1',
              action: 'SETUP',
              tableName: 'system',
              details: 'تم تجهيز نظام محل شفرة للمالك كريم بنجاح',
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (e) {
        console.error('Error loading shop data from storage:', e);
        setProducts(defaultProducts);
        setCustomers(defaultCustomers);
        setSuppliers(defaultSuppliers);
        setSupplierPayments(defaultSupplierPayments);
        setDamagedItems(defaultDamagedItems);
        setDrawerSessions([defaultDrawer]);
      }
      setIsAuthenticated(true);
      setIsAuthChecking(false);
      setIsLoaded(true);
      return;
    }

    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      const user = data?.user;
      if (!user) {
        setUserId(null);
        setUserEmail(null);
        setIsAuthenticated(false);
        clearShopState();
        setIsAuthChecking(false);
        setIsLoaded(true);
      } else {
        setUserId(user.id);
        setUserEmail(user.email || null);
        setIsAuthenticated(true);
        void hydrateFromSupabase(user.id, user.email);
      }
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      const user = session?.user;
      if (!user || event === 'SIGNED_OUT') {
        setUserId(null);
        setUserEmail(null);
        setIsAuthenticated(false);
        clearShopState();
        setIsAuthChecking(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUserId(user.id);
        setUserEmail(user.email || null);
        setIsAuthenticated(true);
        void hydrateFromSupabase(user.id, user.email);
      }
    });

    return () => {
      isMounted = false;
      authSub.subscription.unsubscribe();
    };
  }, [supabase, clearShopState, hydrateFromSupabase]);

  // توجيه غير المسجلين إلى صفحة الدخول عند تفعيل Supabase
  useEffect(() => {
    if (!supabase || isAuthChecking) return;
    if (!isAuthenticated && pathname !== '/login') {
      router.replace('/login');
    } else if (isAuthenticated && pathname === '/login') {
      router.replace('/');
    }
  }, [supabase, isAuthChecking, isAuthenticated, pathname, router]);

  // حفظ البيانات تلقائياً في التخزين المحلي فقط عند العمل دون Supabase
  useEffect(() => {
    if (!isLoaded || supabase) return;
    try {
      const stateToSave = {
        products,
        customers,
        suppliers,
        supplierPayments,
        damagedItems,
        salesInvoices,
        purchaseInvoices,
        expenses,
        ownerWithdrawals,
        physicalCounts,
        drawerSessions,
        auditLogs,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save store state to localStorage:', e);
    }
  }, [
    isLoaded,
    supabase,
    products,
    customers,
    suppliers,
    supplierPayments,
    damagedItems,
    salesInvoices,
    purchaseInvoices,
    expenses,
    ownerWithdrawals,
    physicalCounts,
    drawerSessions,
    auditLogs,
  ]);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearShopState();
    setUserId(null);
    setUserEmail(null);
    setIsAuthenticated(false);
    router.replace('/login');
  }, [supabase, clearShopState, router]);

  const syncSb = useCallback(
    (task: (sb: NonNullable<typeof supabase>, sId: string, uId: string) => Promise<void>) => {
      if (!supabase || !shopId || !userId) return;
      void task(supabase, shopId, userId).catch((err) => {
        console.error('Supabase sync error:', err);
      });
    },
    [supabase, shopId, userId]
  );

  const activeDrawer = drawerSessions.find((s) => s.status === 'open') || null;

  const logAudit = (action: string, tableName: string, details: string, recordId?: string) => {
    const newId = generateUuid();
    const newLog: AuditLog = {
      id: newId,
      action,
      tableName,
      details,
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 99)]);
    syncSb(async (sb, sId, uId) => {
      await sb.from('audit_logs').insert({
        id: newId,
        shop_id: sId,
        table_name: tableName,
        record_id: recordId || newId,
        action,
        new_data: { details },
        changed_by: uId,
      });
    });
  };

  // 1. المنتجات
  const addProduct = (data: Omit<Product, 'id' | 'createdAt' | 'currentStock'>) => {
    const prodId = generateUuid();
    const newProduct: Product = {
      ...data,
      id: prodId,
      currentStock: data.openingStock,
      createdAt: new Date().toISOString(),
    };
    setProducts((prev) => [newProduct, ...prev]);
    syncSb(async (sb, sId) => {
      await sb.from('products').insert({
        id: prodId,
        shop_id: sId,
        name: newProduct.name,
        barcode: newProduct.barcode || null,
        category_name: newProduct.category || 'عام',
        cost_price: newProduct.costPrice,
        extra_cost: newProduct.extraCost,
        sale_price: newProduct.salePrice,
        opening_stock: newProduct.openingStock,
        current_stock: newProduct.currentStock,
        min_stock_alert: newProduct.minStockAlert,
        unit: newProduct.unit || 'قطعة',
      });
    });
    logAudit('CREATE', 'products', `إضافة منتج جديد: ${newProduct.name}`, prodId);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          logAudit('UPDATE', 'products', `تعديل بيانات المنتج: ${p.name}`, id);
          return updated;
        }
        return p;
      })
    );
    syncSb(async (sb, sId) => {
      const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.barcode !== undefined) dbUpdates.barcode = updates.barcode;
      if (updates.category !== undefined) dbUpdates.category_name = updates.category;
      if (updates.costPrice !== undefined) dbUpdates.cost_price = updates.costPrice;
      if (updates.extraCost !== undefined) dbUpdates.extra_cost = updates.extraCost;
      if (updates.salePrice !== undefined) dbUpdates.sale_price = updates.salePrice;
      if (updates.currentStock !== undefined) dbUpdates.current_stock = updates.currentStock;
      if (updates.minStockAlert !== undefined) dbUpdates.min_stock_alert = updates.minStockAlert;
      if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
      await sb.from('products').update(dbUpdates).eq('id', id).eq('shop_id', sId);
    });
  };

  const deleteProduct = (id: string) => {
    const deletedAt = new Date().toISOString();
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, deletedAt } : p))
    );
    syncSb(async (sb, sId) => {
      await sb.from('products').update({ deleted_at: deletedAt }).eq('id', id).eq('shop_id', sId);
    });
    logAudit('DELETE', 'products', `حذف منتج (Soft Delete) معرف: ${id}`, id);
  };

  // 2. العملاء
  const addCustomer = (data: Omit<Customer, 'id' | 'createdAt' | 'currentBalance'> & { initialBalance?: number }) => {
    const custId = generateUuid();
    const newCustomer: Customer = {
      id: custId,
      name: data.name,
      phone: data.phone || '',
      creditLimit: data.creditLimit || 0,
      currentBalance: data.initialBalance || 0,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    };
    setCustomers((prev) => [newCustomer, ...prev]);
    syncSb(async (sb, sId) => {
      await sb.from('customers').insert({
        id: custId,
        shop_id: sId,
        name: newCustomer.name,
        phone: newCustomer.phone || null,
        credit_limit: newCustomer.creditLimit,
        current_balance: newCustomer.currentBalance,
        notes: newCustomer.notes || null,
      });
    });
    logAudit('CREATE', 'customers', `إضافة عميل جديد: ${newCustomer.name}`, custId);
    return newCustomer;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    syncSb(async (sb, sId) => {
      const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.creditLimit !== undefined) dbUpdates.credit_limit = updates.creditLimit;
      if (updates.currentBalance !== undefined) dbUpdates.current_balance = updates.currentBalance;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      await sb.from('customers').update(dbUpdates).eq('id', id).eq('shop_id', sId);
    });
  };

  const addCustomerPayment = (
    customerId: string,
    amount: number,
    method: 'cash' | 'wallet' | 'instapay',
    notes?: string
  ) => {
    const targetCust = customers.find((c) => c.id === customerId);
    const updatedBal = targetCust ? Number(Math.max(0, targetCust.currentBalance - amount).toFixed(2)) : 0;

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const newBal = Number(Math.max(0, c.currentBalance - amount).toFixed(2));
          return { ...c, currentBalance: newBal };
        }
        return c;
      })
    );

    let updatedDrawerPayload: Record<string, number> | null = null;
    // إضافة الوارد النقدي للدرج إن كان كاش
    if (activeDrawer) {
      const newCashDebt = method === 'cash' ? activeDrawer.cashDebtPayments + amount : activeDrawer.cashDebtPayments;
      const newWallet = method === 'wallet' ? activeDrawer.walletTotal + amount : activeDrawer.walletTotal;
      const newInstapay = method === 'instapay' ? activeDrawer.instapayTotal + amount : activeDrawer.instapayTotal;
      const expected = calculateDrawerExpectedCash({
        openingCash: activeDrawer.openingCash,
        cashSales: activeDrawer.cashSales,
        cashDebtPayments: newCashDebt,
        cashExpenses: activeDrawer.cashExpenses,
        cashSupplierPayments: activeDrawer.cashSupplierPayments,
        cashReturns: activeDrawer.cashReturns,
        cashWithdrawals: activeDrawer.cashWithdrawals,
      }).expectedCash;

      updatedDrawerPayload = {
        cash_customer_debt_payments: newCashDebt,
        wallet_total: newWallet,
        instapay_total: newInstapay,
        expected_cash: expected,
      };

      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === activeDrawer.id
            ? {
                ...d,
                cashDebtPayments: newCashDebt,
                walletTotal: newWallet,
                instapayTotal: newInstapay,
                expectedCash: expected,
              }
            : d
        )
      );
    }

    const activeDrawerId = activeDrawer?.id || null;
    syncSb(async (sb, sId, uId) => {
      await sb.from('customers').update({ current_balance: updatedBal }).eq('id', customerId).eq('shop_id', sId);
      await sb.from('customer_transactions').insert({
        shop_id: sId,
        customer_id: customerId,
        transaction_type: 'payment',
        amount: -Math.abs(amount),
        payment_method: method,
        notes: notes || null,
        created_by: uId,
      });
      if (activeDrawerId && updatedDrawerPayload) {
        await sb.from('drawer_sessions').update(updatedDrawerPayload).eq('id', activeDrawerId).eq('shop_id', sId);
      }
    });

    logAudit('PAYMENT', 'customers', `تحصيل سداد دين عميل بقيمة ${amount} ج.م بطريقة ${method} (${notes || ''})`, customerId);
  };

  // 3. الموردين
  const addSupplier = (data: Omit<Supplier, 'id' | 'createdAt' | 'owedBalance'> & { initialBalance?: number }) => {
    const suppId = generateUuid();
    const newSupplier: Supplier = {
      id: suppId,
      name: data.name,
      company: data.company || '',
      phone: data.phone || '',
      owedBalance: data.initialBalance || 0,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    };
    setSuppliers((prev) => [newSupplier, ...prev]);
    syncSb(async (sb, sId) => {
      await sb.from('suppliers').insert({
        id: suppId,
        shop_id: sId,
        name: newSupplier.name,
        company: newSupplier.company || null,
        phone: newSupplier.phone || null,
        owed_balance: newSupplier.owedBalance,
        notes: newSupplier.notes || null,
      });
    });
    logAudit('CREATE', 'suppliers', `إضافة مورد جديد: ${newSupplier.name}`, suppId);
    return newSupplier;
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    syncSb(async (sb, sId) => {
      const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.company !== undefined) dbUpdates.company = updates.company;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.owedBalance !== undefined) dbUpdates.owed_balance = updates.owedBalance;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      await sb.from('suppliers').update(dbUpdates).eq('id', id).eq('shop_id', sId);
    });
  };

  const addSupplierPayment = (
    supplierIdOrData:
      | string
      | {
          supplierId: string;
          amount: number;
          method: 'cash' | 'wallet' | 'instapay' | 'bank';
          date?: string;
          notes?: string;
        },
    amountArg?: number,
    methodArg?: 'cash' | 'wallet' | 'instapay' | 'bank',
    notesArg?: string
  ) => {
    let targetSupplierId: string;
    let amount: number;
    let method: 'cash' | 'wallet' | 'instapay' | 'bank';
    let date: string;
    let notes: string;

    if (typeof supplierIdOrData === 'object') {
      targetSupplierId = supplierIdOrData.supplierId;
      amount = Number((supplierIdOrData.amount || 0).toFixed(2));
      method = supplierIdOrData.method || 'cash';
      date = supplierIdOrData.date || new Date().toISOString().split('T')[0];
      notes = supplierIdOrData.notes || '';
    } else {
      targetSupplierId = supplierIdOrData;
      amount = Number((amountArg || 0).toFixed(2));
      method = methodArg || 'cash';
      date = new Date().toISOString().split('T')[0];
      notes = notesArg || '';
    }

    if (amount <= 0) return;

    const supplier = suppliers.find((s) => s.id === targetSupplierId);
    const supplierName = supplier?.name || 'مورد';
    const nextOwedBalance = supplier
      ? Number(Math.max(0, supplier.owedBalance - amount).toFixed(2))
      : 0;

    // 1. تحديث رصيد مستحقات المورد
    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id === targetSupplierId) {
          const newBal = Number(Math.max(0, s.owedBalance - amount).toFixed(2));
          return { ...s, owedBalance: newBal };
        }
        return s;
      })
    );

    // 2. تسجيل حركة السداد في كشف حساب المورد
    const spayId = generateUuid();
    const newPayment: SupplierPayment = {
      id: spayId,
      supplierId: targetSupplierId,
      supplierName,
      amount,
      paymentMethod: method,
      paymentDate: date,
      notes,
      drawerSessionId: activeDrawer?.id || null,
      createdAt: new Date().toISOString(),
    };
    setSupplierPayments((prev) => [newPayment, ...prev]);

    // 3. خصم من الدرج إن كان كاش
    let updatedSupCash: { cash_supplier_payments: number; expected_cash: number } | null = null;
    if (activeDrawer && method === 'cash') {
      const newSupplierPays = activeDrawer.cashSupplierPayments + amount;
      const expected = calculateDrawerExpectedCash({
        openingCash: activeDrawer.openingCash,
        cashSales: activeDrawer.cashSales,
        cashDebtPayments: activeDrawer.cashDebtPayments,
        cashExpenses: activeDrawer.cashExpenses,
        cashSupplierPayments: newSupplierPays,
        cashReturns: activeDrawer.cashReturns,
        cashWithdrawals: activeDrawer.cashWithdrawals,
      }).expectedCash;
      updatedSupCash = { cash_supplier_payments: newSupplierPays, expected_cash: expected };
      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === activeDrawer.id
            ? { ...d, cashSupplierPayments: newSupplierPays, expectedCash: expected }
            : d
        )
      );
    }

    const activeDrawerId = activeDrawer?.id || null;
    syncSb(async (sb, sId, uId) => {
      await sb.from('suppliers').update({ owed_balance: nextOwedBalance }).eq('id', targetSupplierId).eq('shop_id', sId);
      await sb.from('supplier_payments').insert({
        id: spayId,
        shop_id: sId,
        supplier_id: targetSupplierId,
        amount,
        payment_method: method,
        payment_date: date,
        notes: notes || null,
        drawer_session_id: activeDrawerId,
        created_by: uId,
      });
      if (activeDrawerId && updatedSupCash) {
        await sb.from('drawer_sessions').update(updatedSupCash).eq('id', activeDrawerId).eq('shop_id', sId);
      }
    });

    logAudit('PAYMENT', 'suppliers', `سداد دفعة للمورد ${supplierName} بقيمة ${amount} ج.م بطريقة ${method} بتاريخ ${date} (${notes || ''})`, spayId);
  };

  // 4. فاتورة البيع
  const createSaleInvoice = (data: {
    customerId?: string | null;
    customerName?: string;
    items: Array<{ productId: string; quantity: number; unitPrice?: number; discount?: number }>;
    overallDiscount?: number;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'split';
    paidAmount: number;
    notes?: string;
  }) => {
    // التحقق الصارم من حالة الدرج: إذا كان مقفلاً يمنع إنشاء الفاتورة فوراً
    if (!activeDrawer || activeDrawer.status !== 'open') {
      return {
        invoice: null as any,
        warning: 'الدرج مقفل حالياً! لا يمكن إنشاء فواتير بيع جديدة حتى يتم إعادة فتح الدرج من قبل المالك كريم.',
      };
    }

    let warning: string | undefined;

    // تجهيز بنود الفاتورة وحفظ التكلفة الدائمة
    const processedItems: SaleInvoiceItem[] = [];
    for (const item of data.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) continue;

      const unitCost = Number((prod.costPrice + prod.extraCost).toFixed(2));
      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : prod.salePrice;
      const discount = item.discount || 0;
      const lineTotal = Number(Math.max(0, item.quantity * unitPrice - discount).toFixed(2));
      const lineCost = Number((item.quantity * unitCost).toFixed(2));
      const lineProfit = Number((lineTotal - lineCost).toFixed(2));

      // فحص المخزون السالب
      if (prod.currentStock < item.quantity) {
        warning = `تنبيه: الكمية المباعة من "${prod.name}" أكبر من الرصيد المتوفر (${prod.currentStock})، أصبح المخزون سالباً!`;
      }

      processedItems.push({
        id: generateUuid(),
        productId: prod.id,
        productName: prod.name,
        barcode: prod.barcode,
        quantity: item.quantity,
        unitCost,
        unitPrice,
        discount,
        lineTotal,
        lineCost,
        lineProfit,
      });
    }

    // حساب إجماليات الفاتورة
    const totals = calculateInvoiceTotals(
      processedItems.map((i) => ({
        quantity: i.quantity,
        unitCost: i.unitCost,
        unitPrice: i.unitPrice,
        discount: i.discount,
      })),
      data.overallDiscount || 0,
      data.paidAmount
    );

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(salesInvoices.length + 1).padStart(5, '0')}`;
    const invId = generateUuid();

    const newInvoice: SaleInvoice = {
      id: invId,
      invoiceNumber,
      customerId: data.customerId || null,
      customerName: data.customerName || (data.customerId ? customers.find((c) => c.id === data.customerId)?.name || 'عميل' : 'عميل نقدي'),
      items: processedItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      totalAmount: totals.totalAmount,
      totalCost: totals.totalCost,
      grossProfit: totals.grossProfit,
      paidAmount: totals.paidAmount,
      remainingAmount: totals.remainingDebt,
      paymentMethod: data.paymentMethod,
      drawerSessionId: activeDrawer?.id || null,
      notes: data.notes || '',
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    const stockUpdates: { id: string; nextStock: number }[] = [];
    // 1. خصم الكميات من المخزون
    setProducts((prev) =>
      prev.map((p) => {
        const soldItem = processedItems.find((i) => i.productId === p.id);
        if (soldItem) {
          const newStock = Number((p.currentStock - soldItem.quantity).toFixed(2));
          stockUpdates.push({ id: p.id, nextStock: newStock });
          return { ...p, currentStock: newStock };
        }
        return p;
      })
    );

    // 2. تحديث مديونية العميل إن وجد متبقي
    let nextCustomerBalance: number | null = null;
    if (data.customerId && totals.remainingDebt > 0) {
      const targetCust = customers.find((c) => c.id === data.customerId);
      if (targetCust) {
        nextCustomerBalance = Number((targetCust.currentBalance + totals.remainingDebt).toFixed(2));
        const check = checkCustomerCreditLimit(targetCust.currentBalance, totals.remainingDebt, targetCust.creditLimit);
        if (check.isExceeded) {
          warning = (warning ? warning + ' | ' : '') + `تنبيه ائتمان: العميل تجاوز حد الائتمان بمبلغ ${check.excessAmount} ج.م!`;
        }
      }
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === data.customerId && nextCustomerBalance !== null) {
            return { ...c, currentBalance: nextCustomerBalance };
          }
          return c;
        })
      );
    }

    // 3. تحديث الدرج اليومي
    let drawerUpdatePayload: Record<string, number> | null = null;
    if (activeDrawer) {
      const isCash = data.paymentMethod === 'cash';
      const isWallet = data.paymentMethod === 'wallet';
      const isInstapay = data.paymentMethod === 'instapay';
      const cashAdd = isCash ? totals.paidAmount : (data.paymentMethod === 'split' ? totals.paidAmount : 0);
      const walletAdd = isWallet ? totals.paidAmount : 0;
      const instapayAdd = isInstapay ? totals.paidAmount : 0;

      const nextCashSales = activeDrawer.cashSales + cashAdd;
      const nextWalletTotal = activeDrawer.walletTotal + walletAdd;
      const nextInstapayTotal = activeDrawer.instapayTotal + instapayAdd;
      const expected = calculateDrawerExpectedCash({
        openingCash: activeDrawer.openingCash,
        cashSales: nextCashSales,
        cashDebtPayments: activeDrawer.cashDebtPayments,
        cashExpenses: activeDrawer.cashExpenses,
        cashSupplierPayments: activeDrawer.cashSupplierPayments,
        cashReturns: activeDrawer.cashReturns,
        cashWithdrawals: activeDrawer.cashWithdrawals,
      }).expectedCash;

      drawerUpdatePayload = {
        cash_sales: nextCashSales,
        wallet_total: nextWalletTotal,
        instapay_total: nextInstapayTotal,
        expected_cash: expected,
      };

      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === activeDrawer.id
            ? {
                ...d,
                cashSales: nextCashSales,
                walletTotal: nextWalletTotal,
                instapayTotal: nextInstapayTotal,
                expectedCash: expected,
              }
            : d
        )
      );
    }

    setSalesInvoices((prev) => [newInvoice, ...prev]);

    const activeDrawerId = activeDrawer?.id || null;
    syncSb(async (sb, sId, uId) => {
      await sb.from('sales_invoices').insert({
        id: invId,
        shop_id: sId,
        invoice_number: invoiceNumber,
        customer_id: data.customerId || null,
        customer_name: newInvoice.customerName,
        subtotal: newInvoice.subtotal,
        discount: newInvoice.discount,
        total_amount: newInvoice.totalAmount,
        total_cost: newInvoice.totalCost,
        gross_profit: newInvoice.grossProfit,
        paid_amount: newInvoice.paidAmount,
        remaining_amount: newInvoice.remainingAmount,
        payment_method: newInvoice.paymentMethod,
        status: newInvoice.status,
        drawer_session_id: activeDrawerId,
        notes: newInvoice.notes || null,
        created_by: uId,
      });

      if (processedItems.length > 0) {
        await sb.from('sales_invoice_items').insert(
          processedItems.map((it) => ({
            id: it.id,
            shop_id: sId,
            invoice_id: invId,
            product_id: it.productId,
            product_name: it.productName,
            barcode: it.barcode || null,
            quantity: it.quantity,
            unit_cost: it.unitCost,
            unit_price: it.unitPrice,
            discount: it.discount,
            line_total: it.lineTotal,
            line_cost: it.lineCost,
            line_profit: it.lineProfit,
          }))
        );
      }

      for (const upd of stockUpdates) {
        await sb.from('products').update({ current_stock: upd.nextStock }).eq('id', upd.id).eq('shop_id', sId);
      }

      if (data.customerId && nextCustomerBalance !== null) {
        await sb.from('customers').update({ current_balance: nextCustomerBalance }).eq('id', data.customerId).eq('shop_id', sId);
      }

      if (activeDrawerId && drawerUpdatePayload) {
        await sb.from('drawer_sessions').update(drawerUpdatePayload).eq('id', activeDrawerId).eq('shop_id', sId);
      }
    });

    logAudit('CREATE', 'sales_invoices', `إنشاء فاتورة بيع ${invoiceNumber} بمبلغ ${totals.totalAmount} ج.م`, invId);

    return { invoice: newInvoice, warning };
  };

  // 5. مرتجع مبيعات
  const createSaleReturn = (data: {
    invoiceId?: string;
    productId: string;
    quantity: number;
    refundAmount: number;
    refundMethod: 'cash' | 'wallet' | 'instapay' | 'credit';
    isSellable: boolean;
    reason: string;
  }) => {
    const prod = products.find((p) => p.id === data.productId);
    const nextStock = prod ? Number((prod.currentStock + data.quantity).toFixed(2)) : null;

    // إن كان سليم يعود للمخزون
    if (data.isSellable) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === data.productId
            ? { ...p, currentStock: Number((p.currentStock + data.quantity).toFixed(2)) }
            : p
        )
      );
    }

    // خصم قيمة المرتجع من نقدية الدرج
    let drawerReturnUpdate: { cash_returns: number; expected_cash: number } | null = null;
    if (activeDrawer && data.refundMethod === 'cash') {
      const newReturns = activeDrawer.cashReturns + data.refundAmount;
      const expected = calculateDrawerExpectedCash({
        openingCash: activeDrawer.openingCash,
        cashSales: activeDrawer.cashSales,
        cashDebtPayments: activeDrawer.cashDebtPayments,
        cashExpenses: activeDrawer.cashExpenses,
        cashSupplierPayments: activeDrawer.cashSupplierPayments,
        cashReturns: newReturns,
        cashWithdrawals: activeDrawer.cashWithdrawals,
      }).expectedCash;
      drawerReturnUpdate = { cash_returns: newReturns, expected_cash: expected };
      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === activeDrawer.id ? { ...d, cashReturns: newReturns, expectedCash: expected } : d
        )
      );
    }

    const retId = generateUuid();
    const activeDrawerId = activeDrawer?.id || null;
    syncSb(async (sb, sId, uId) => {
      if (data.isSellable && nextStock !== null) {
        await sb.from('products').update({ current_stock: nextStock }).eq('id', data.productId).eq('shop_id', sId);
      }
      await sb.from('sales_returns').insert({
        id: retId,
        shop_id: sId,
        return_number: `RET-${Date.now()}`,
        invoice_id: data.invoiceId || null,
        refund_amount: data.refundAmount,
        refund_method: data.refundMethod === 'credit' ? 'credit_balance' : data.refundMethod,
        drawer_session_id: activeDrawerId,
        reason: data.reason,
        created_by: uId,
      });
      await sb.from('sales_return_items').insert({
        id: generateUuid(),
        shop_id: sId,
        return_id: retId,
        product_id: data.productId,
        product_name: prod?.name || 'صنف',
        quantity: data.quantity,
        unit_refund_price: data.quantity > 0 ? Number((data.refundAmount / data.quantity).toFixed(2)) : 0,
        unit_cost: prod ? prod.costPrice + prod.extraCost : 0,
        condition: data.isSellable ? 'sellable' : 'damaged',
      });
      if (activeDrawerId && drawerReturnUpdate) {
        await sb.from('drawer_sessions').update(drawerReturnUpdate).eq('id', activeDrawerId).eq('shop_id', sId);
      }
    });

    logAudit('RETURN', 'sales_returns', `مرتجع مبيعات: منتج ${data.productId} كمية ${data.quantity} (${data.isSellable ? 'سليم أعيد للمخزون' : 'تالف/هالك'})`, retId);
  };

  // 6. فاتورة مشتريات وتوريد بضاعة (تدعم أصناف موجودة أو إنشاء أصناف جديدة مباشرة مع باركود تلقائي)
  const createPurchaseInvoice = (data: {
    supplierId?: string | null;
    supplierName: string;
    items: Array<{
      productId?: string;
      productName?: string;
      isNew?: boolean;
      quantity: number;
      unitCost: number;
    }>;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'bank';
    paidAmount: number;
    invoicePhotoUrl?: string | null;
    notes?: string;
  }) => {
    let total = 0;
    const processedItems: PurchaseInvoiceItem[] = [];
    const newlyCreatedProducts: Product[] = [];
    const updatedExistingProductsMap: Record<string, { quantity: number; unitCost: number }> = {};

    const existingBarcodes = products.map((p) => p.barcode).filter(Boolean);

    for (const item of data.items) {
      const lineTotal = Number((item.quantity * item.unitCost).toFixed(2));
      total += lineTotal;

      const isNewItem = item.isNew || !item.productId || item.productId === '__new__';

      if (isNewItem) {
        // إنشاء صنف جديد في النظام تلقائياً مع باركود فريد
        const barcode = generateUniqueBarcode([
          ...existingBarcodes,
          ...newlyCreatedProducts.map((p) => p.barcode),
        ]);
        const newProdId = generateUuid();
        const prodName = item.productName?.trim() || 'صنف جديد';

        const newProd: Product = {
          id: newProdId,
          name: prodName,
          barcode,
          category: 'عام',
          costPrice: item.unitCost,
          extraCost: 0,
          salePrice: Number((item.unitCost * 1.25).toFixed(2)),
          openingStock: 0,
          currentStock: item.quantity,
          minStockAlert: 5,
          unit: 'قطعة',
          createdAt: new Date().toISOString(),
        };

        newlyCreatedProducts.push(newProd);

        processedItems.push({
          id: generateUuid(),
          productId: newProdId,
          productName: prodName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          lineTotal,
        });
      } else {
        const prod = products.find((p) => p.id === item.productId);
        const prodName = prod?.name || item.productName || 'صنف';
        updatedExistingProductsMap[item.productId!] = {
          quantity: item.quantity,
          unitCost: item.unitCost,
        };

        processedItems.push({
          id: generateUuid(),
          productId: item.productId!,
          productName: prodName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          lineTotal,
        });
      }
    }

    total = Number(total.toFixed(2));
    const paid = Number(data.paidAmount.toFixed(2));
    const remaining = Number((total - paid).toFixed(2));

    const invoiceNumber = `PUR-${new Date().getFullYear()}-${String(purchaseInvoices.length + 1).padStart(5, '0')}`;
    const purId = generateUuid();

    const newPurchase: PurchaseInvoice = {
      id: purId,
      invoiceNumber,
      supplierId: data.supplierId || null,
      supplierName: data.supplierName,
      items: processedItems,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: Math.max(0, remaining),
      paymentMethod: data.paymentMethod,
      drawerSessionId: activeDrawer?.id || null,
      notes: data.notes || '',
      invoicePhotoUrl: data.invoicePhotoUrl || null,
      createdAt: new Date().toISOString(),
    };

    const existingStockUpdates: { id: string; currentStock: number; costPrice: number }[] = [];
    // 1. تحديث المنتجات: إضافة الأصناف الجديدة وزيادة أرصدة الأصناف القديمة وتحديث تكلفة الشراء
    setProducts((prev) => {
      const updatedExisting = prev.map((p) => {
        const delta = updatedExistingProductsMap[p.id];
        if (delta) {
          const nextStock = Number((p.currentStock + delta.quantity).toFixed(2));
          existingStockUpdates.push({ id: p.id, currentStock: nextStock, costPrice: delta.unitCost });
          return {
            ...p,
            currentStock: nextStock,
            costPrice: delta.unitCost,
          };
        }
        return p;
      });
      return [...newlyCreatedProducts, ...updatedExisting];
    });

    // 2. تحديث مستحق المورد
    let nextSupplierOwed: number | null = null;
    let immediatePayment: SupplierPayment | null = null;
    if (data.supplierId) {
      const supp = suppliers.find((s) => s.id === data.supplierId);
      nextSupplierOwed = supp
        ? Number(Math.max(0, supp.owedBalance + (total - paid)).toFixed(2))
        : Number(Math.max(0, total - paid).toFixed(2));
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === data.supplierId && nextSupplierOwed !== null
            ? { ...s, owedBalance: nextSupplierOwed }
            : s
        )
      );

      // تسجيل دفعة السداد الفورية في كشف حساب المورد إن كان هناك مبلغ مدفوع
      if (paid > 0) {
        immediatePayment = {
          id: generateUuid(),
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          amount: paid,
          paymentMethod: data.paymentMethod === 'credit' ? 'cash' : data.paymentMethod,
          paymentDate: new Date().toISOString().split('T')[0],
          notes: `سداد فوري مع فاتورة توريد رقم #${invoiceNumber}`,
          drawerSessionId: activeDrawer?.id || null,
          createdAt: new Date().toISOString(),
        };
        setSupplierPayments((prev) => [immediatePayment!, ...prev]);
      }
    }

    // 3. خصم المدفوع كاش من الدرج
    let purDrawerUpdate: { cash_supplier_payments: number; expected_cash: number } | null = null;
    if (activeDrawer && data.paymentMethod === 'cash' && paid > 0) {
      const newSupPay = activeDrawer.cashSupplierPayments + paid;
      const expected = calculateDrawerExpectedCash({
        openingCash: activeDrawer.openingCash,
        cashSales: activeDrawer.cashSales,
        cashDebtPayments: activeDrawer.cashDebtPayments,
        cashExpenses: activeDrawer.cashExpenses,
        cashSupplierPayments: newSupPay,
        cashReturns: activeDrawer.cashReturns,
        cashWithdrawals: activeDrawer.cashWithdrawals,
      }).expectedCash;
      purDrawerUpdate = { cash_supplier_payments: newSupPay, expected_cash: expected };
      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === activeDrawer.id ? { ...d, cashSupplierPayments: newSupPay, expectedCash: expected } : d
        )
      );
    }

    setPurchaseInvoices((prev) => [newPurchase, ...prev]);

    const activeDrawerId = activeDrawer?.id || null;
    syncSb(async (sb, sId, uId) => {
      let uploadedPhotoUrl = newPurchase.invoicePhotoUrl || null;
      if (uploadedPhotoUrl && uploadedPhotoUrl.startsWith('data:')) {
        uploadedPhotoUrl = await uploadInvoicePhotoToStorage(sb, sId, purId, uploadedPhotoUrl);
      }

      if (newlyCreatedProducts.length > 0) {
        await sb.from('products').insert(
          newlyCreatedProducts.map((np) => ({
            id: np.id,
            shop_id: sId,
            name: np.name,
            barcode: np.barcode,
            category_name: np.category,
            cost_price: np.costPrice,
            extra_cost: np.extraCost,
            sale_price: np.salePrice,
            opening_stock: np.openingStock,
            current_stock: np.currentStock,
            min_stock_alert: np.minStockAlert,
            unit: np.unit,
          }))
        );
      }

      for (const upd of existingStockUpdates) {
        await sb
          .from('products')
          .update({ current_stock: upd.currentStock, cost_price: upd.costPrice })
          .eq('id', upd.id)
          .eq('shop_id', sId);
      }

      await sb.from('purchase_invoices').insert({
        id: purId,
        shop_id: sId,
        invoice_number: invoiceNumber,
        supplier_id: data.supplierId || null,
        supplier_name: data.supplierName,
        total_amount: total,
        paid_amount: paid,
        remaining_amount: Math.max(0, remaining),
        payment_method: data.paymentMethod,
        drawer_session_id: activeDrawerId,
        invoice_photo_url: uploadedPhotoUrl,
        notes: data.notes || null,
        created_by: uId,
      });

      if (processedItems.length > 0) {
        await sb.from('purchase_invoice_items').insert(
          processedItems.map((it) => ({
            id: it.id,
            shop_id: sId,
            purchase_id: purId,
            product_id: it.productId,
            product_name: it.productName,
            quantity: it.quantity,
            unit_cost: it.unitCost,
            line_total: it.lineTotal,
          }))
        );
      }

      if (data.supplierId && nextSupplierOwed !== null) {
        await sb.from('suppliers').update({ owed_balance: nextSupplierOwed }).eq('id', data.supplierId).eq('shop_id', sId);
      }

      if (immediatePayment) {
        await sb.from('supplier_payments').insert({
          id: immediatePayment.id,
          shop_id: sId,
          supplier_id: immediatePayment.supplierId,
          amount: immediatePayment.amount,
          payment_method: immediatePayment.paymentMethod,
          payment_date: immediatePayment.paymentDate,
          notes: immediatePayment.notes || null,
          drawer_session_id: activeDrawerId,
          created_by: uId,
        });
      }

      if (activeDrawerId && purDrawerUpdate) {
        await sb.from('drawer_sessions').update(purDrawerUpdate).eq('id', activeDrawerId).eq('shop_id', sId);
      }
    });

    logAudit(
      'CREATE',
      'purchase_invoices',
      `فاتورة توريد ${invoiceNumber} من ${data.supplierName} بإجمالي ${total} ج.م ومسدد منها ${paid} ج.م`,
      purId
    );
  };

  // إضافة هالك وتوالف (ينقص المخزون ويحسب خسارة بالتكلفة ويوثق بسجل غير قابل للحذف)
  const addDamagedItem = (data: {
    productId?: string | null;
    productName?: string;
    quantity: number;
    unitCost?: number;
    reason: string;
    date?: string;
    notes?: string;
  }) => {
    const qty = Number(data.quantity.toFixed(2));
    let finalName = data.productName?.trim() || '';
    let finalUnitCost = data.unitCost || 0;
    let nextProductStock: number | null = null;

    if (data.productId) {
      const prod = products.find((p) => p.id === data.productId);
      if (prod) {
        finalName = prod.name;
        finalUnitCost = Number((prod.costPrice + prod.extraCost).toFixed(2));
        nextProductStock = Number(Math.max(0, prod.currentStock - qty).toFixed(2));
        // خفض رصيد المخزون فوراً
        setProducts((prev) =>
          prev.map((p) =>
            p.id === data.productId && nextProductStock !== null
              ? { ...p, currentStock: nextProductStock }
              : p
          )
        );
      }
    }

    const totalLoss = Number((qty * finalUnitCost).toFixed(2));
    const dmgId = generateUuid();
    const damageDate = data.date || new Date().toISOString().split('T')[0];
    const newDamaged: DamagedItem = {
      id: dmgId,
      productId: data.productId || null,
      productName: finalName || 'صنف هالك',
      quantity: qty,
      unitCost: finalUnitCost,
      totalLoss,
      reason: data.reason,
      notes: data.notes || '',
      date: damageDate,
      createdAt: new Date().toISOString(),
    };

    setDamagedItems((prev) => [newDamaged, ...prev]);

    syncSb(async (sb, sId, uId) => {
      if (data.productId && nextProductStock !== null) {
        await sb.from('products').update({ current_stock: nextProductStock }).eq('id', data.productId).eq('shop_id', sId);
      }
      await sb.from('damaged_items').insert({
        id: dmgId,
        shop_id: sId,
        product_id: data.productId || null,
        product_name: newDamaged.productName,
        quantity: qty,
        unit_cost: finalUnitCost,
        total_loss: totalLoss,
        reason: data.reason,
        notes: data.notes || null,
        damage_date: damageDate,
        created_by: uId,
      });
    });

    logAudit(
      'DAMAGE',
      'damaged_items',
      `تسجيل هالك وتوالف: ${finalName} كمية ${qty} بخسارة إجمالية ${totalLoss} ج.م (السبب: ${data.reason})`,
      dmgId
    );
  };

  // 7. المصروفات
  const addExpense = (data: Omit<Expense, 'id' | 'createdAt'>) => {
    const expId = generateUuid();
    const newExpense: Expense = {
      ...data,
      id: expId,
      createdAt: new Date().toISOString(),
      drawerSessionId: activeDrawer?.id || null,
    };

    setExpenses((prev) => [newExpense, ...prev]);

    // خصم من الدرج إن كان كاش
    let drawerExpUpdate: { cash_expenses: number; expected_cash: number } | null = null;
    if (activeDrawer && data.paymentMethod === 'cash') {
      const newExpenses = activeDrawer.cashExpenses + data.amount;
      const expected = calculateDrawerExpectedCash({
        openingCash: activeDrawer.openingCash,
        cashSales: activeDrawer.cashSales,
        cashDebtPayments: activeDrawer.cashDebtPayments,
        cashExpenses: newExpenses,
        cashSupplierPayments: activeDrawer.cashSupplierPayments,
        cashReturns: activeDrawer.cashReturns,
        cashWithdrawals: activeDrawer.cashWithdrawals,
      }).expectedCash;
      drawerExpUpdate = { cash_expenses: newExpenses, expected_cash: expected };
      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === activeDrawer.id ? { ...d, cashExpenses: newExpenses, expectedCash: expected } : d
        )
      );
    }

    const activeDrawerId = activeDrawer?.id || null;
    syncSb(async (sb, sId, uId) => {
      await sb.from('expenses').insert({
        id: expId,
        shop_id: sId,
        type: data.type,
        category: data.category,
        amount: data.amount,
        payment_method: data.paymentMethod,
        expense_date: data.date,
        drawer_session_id: activeDrawerId,
        notes: data.notes || null,
        created_by: uId,
      });
      if (activeDrawerId && drawerExpUpdate) {
        await sb.from('drawer_sessions').update(drawerExpUpdate).eq('id', activeDrawerId).eq('shop_id', sId);
      }
    });

    logAudit('CREATE', 'expenses', `صرف مصروف ${data.type === 'fixed' ? 'ثابت' : 'متغير'}: ${data.category} بمبلغ ${data.amount} ج.م`, expId);
  };

  // 8. مسحوبات المالك
  const addOwnerWithdrawal = (data: Omit<OwnerWithdrawal, 'id' | 'createdAt' | 'ownerName'>) => {
    const wthId = generateUuid();
    const newWithdrawal: OwnerWithdrawal = {
      ...data,
      id: wthId,
      ownerName,
      createdAt: new Date().toISOString(),
      drawerSessionId: activeDrawer?.id || null,
    };

    setOwnerWithdrawals((prev) => [newWithdrawal, ...prev]);

    // خصم من نقدية الدرج
    let drawerWthUpdate: { cash_withdrawals: number; expected_cash: number } | null = null;
    if (activeDrawer && data.paymentMethod === 'cash') {
      const newWithdrawals = activeDrawer.cashWithdrawals + data.amount;
      const expected = calculateDrawerExpectedCash({
        openingCash: activeDrawer.openingCash,
        cashSales: activeDrawer.cashSales,
        cashDebtPayments: activeDrawer.cashDebtPayments,
        cashExpenses: activeDrawer.cashExpenses,
        cashSupplierPayments: activeDrawer.cashSupplierPayments,
        cashReturns: activeDrawer.cashReturns,
        cashWithdrawals: newWithdrawals,
      }).expectedCash;
      drawerWthUpdate = { cash_withdrawals: newWithdrawals, expected_cash: expected };
      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === activeDrawer.id ? { ...d, cashWithdrawals: newWithdrawals, expectedCash: expected } : d
        )
      );
    }

    const activeDrawerId = activeDrawer?.id || null;
    syncSb(async (sb, sId, uId) => {
      await sb.from('owner_withdrawals').insert({
        id: wthId,
        shop_id: sId,
        amount: data.amount,
        payment_method: data.paymentMethod,
        withdrawal_date: data.date,
        drawer_session_id: activeDrawerId,
        reason: data.reason || null,
        created_by: uId,
      });
      if (activeDrawerId && drawerWthUpdate) {
        await sb.from('drawer_sessions').update(drawerWthUpdate).eq('id', activeDrawerId).eq('shop_id', sId);
      }
    });

    logAudit('WITHDRAWAL', 'owner_withdrawals', `مسحوبات شخصية للمالك (${ownerName}) بمبلغ ${data.amount} ج.م (${data.reason})`, wthId);
  };

  // 9. الجرد الفعلي للمخزون
  const savePhysicalCountDraft = (
    items: Array<{ productId: string; countedStock: number }>,
    notes?: string
  ): string => {
    let totalVarCost = 0;
    const processedItems: PhysicalCountItem[] = [];

    for (const item of items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) continue;
      const systemStock = prod.currentStock;
      const variance = Number((item.countedStock - systemStock).toFixed(2));
      const unitCost = Number((prod.costPrice + prod.extraCost).toFixed(2));
      const varianceCost = Number((variance * unitCost).toFixed(2));
      totalVarCost += varianceCost;

      processedItems.push({
        id: generateUuid(),
        productId: prod.id,
        productName: prod.name,
        systemStock,
        countedStock: item.countedStock,
        variance,
        unitCost,
        varianceCost,
      });
    }

    const countId = generateUuid();
    const countDate = new Date().toISOString().split('T')[0];
    const newCount: PhysicalCount = {
      id: countId,
      countNumber: physicalCounts.length + 1,
      countDate,
      status: 'draft',
      items: processedItems,
      totalVarianceCost: Number(totalVarCost.toFixed(2)),
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };

    setPhysicalCounts((prev) => [newCount, ...prev]);

    syncSb(async (sb, sId, uId) => {
      await sb.from('physical_inventory_counts').insert({
        id: countId,
        shop_id: sId,
        count_date: countDate,
        status: 'draft',
        total_variance_cost: newCount.totalVarianceCost,
        notes: newCount.notes || null,
        created_by: uId,
      });
      if (processedItems.length > 0) {
        await sb.from('physical_inventory_items').insert(
          processedItems.map((it) => ({
            id: it.id,
            shop_id: sId,
            count_id: countId,
            product_id: it.productId,
            product_name: it.productName,
            system_stock: it.systemStock,
            counted_stock: it.countedStock,
            variance: it.variance,
            unit_cost: it.unitCost,
            variance_cost: it.varianceCost,
          }))
        );
      }
    });

    logAudit('CREATE', 'physical_counts', `مسودة جرد مخزن رقم #${newCount.countNumber}`, countId);
    return newCount.id;
  };

  const approvePhysicalCount = (countId: string) => {
    const count = physicalCounts.find((c) => c.id === countId);
    if (!count) return;
    const approvedAt = new Date().toISOString();

    // تطبيق التسويات واعتماد الرصيد الفعلي في المخزن
    setProducts((prev) =>
      prev.map((p) => {
        const cItem = count.items.find((item) => item.productId === p.id);
        if (cItem) {
          return { ...p, currentStock: cItem.countedStock };
        }
        return p;
      })
    );

    setPhysicalCounts((prev) =>
      prev.map((c) =>
        c.id === countId
          ? {
              ...c,
              status: 'approved',
              approvedAt,
              approvedBy: ownerName,
            }
          : c
      )
    );

    syncSb(async (sb, sId, uId) => {
      for (const cItem of count.items) {
        await sb.from('products').update({ current_stock: cItem.countedStock }).eq('id', cItem.productId).eq('shop_id', sId);
      }
      await sb
        .from('physical_inventory_counts')
        .update({ status: 'approved', approved_at: approvedAt, approved_by: uId })
        .eq('id', countId)
        .eq('shop_id', sId);
    });

    logAudit('APPROVE', 'physical_counts', `اعتماد نتيجة الجرد الفعلي رقم #${count.countNumber} وتحديث أرصدة المخزن رسمياً`, countId);
  };

  // 10. الدرج اليومي
  const openNewDrawerSession = (openingCash: number) => {
    const drawerId = generateUuid();
    const openedAt = new Date().toISOString();
    const newSession: DrawerSession = {
      id: drawerId,
      sessionNumber: drawerSessions.length + 1,
      openedAt,
      status: 'open',
      openingCash: Number(openingCash.toFixed(2)),
      cashSales: 0,
      cashReturns: 0,
      cashDebtPayments: 0,
      cashSupplierPayments: 0,
      cashExpenses: 0,
      cashWithdrawals: 0,
      expectedCash: Number(openingCash.toFixed(2)),
      actualCash: null,
      difference: null,
      walletTotal: 0,
      instapayTotal: 0,
    };

    setDrawerSessions((prev) => [newSession, ...prev]);

    syncSb(async (sb, sId, uId) => {
      await sb.from('drawer_sessions').insert({
        id: drawerId,
        shop_id: sId,
        status: 'open',
        opened_at: openedAt,
        opening_cash: newSession.openingCash,
        expected_cash: newSession.expectedCash,
        opened_by: uId,
      });
    });

    logAudit('OPEN', 'drawer_sessions', `فتح وردية درج جديدة برصيد افتتاحي ${openingCash} ج.م`, drawerId);
  };

  const closeDrawerSession = (actualCash: number, closingNotes?: string) => {
    if (!activeDrawer) return;

    const actual = Number(actualCash.toFixed(2));
    const difference = Number((actual - activeDrawer.expectedCash).toFixed(2));
    const closedAt = new Date().toISOString();
    const targetId = activeDrawer.id;

    setDrawerSessions((prev) =>
      prev.map((d) => {
        if (d.id === targetId) {
          return {
            ...d,
            status: 'closed',
            closedAt,
            actualCash: actual,
            difference,
            closingNotes: closingNotes || '',
          };
        }
        return d;
      })
    );

    syncSb(async (sb, sId, uId) => {
      await sb
        .from('drawer_sessions')
        .update({
          status: 'closed',
          closed_at: closedAt,
          actual_cash: actual,
          difference,
          closing_notes: closingNotes || null,
          closed_by: uId,
        })
        .eq('id', targetId)
        .eq('shop_id', sId);
    });

    logAudit(
      'CLOSE',
      'drawer_sessions',
      `إغلاق الدرج: المتوقع ${activeDrawer.expectedCash} ج.م، الفعلي ${actual} ج.م (الفارق: ${difference} ج.م)`,
      targetId
    );
  };

  const reopenDrawerSession = (sessionId?: string) => {
    const timestamp = new Date().toISOString();
    const formattedTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const targetId = sessionId || drawerSessions.find((d) => d.status === 'closed')?.id;
    setDrawerSessions((prev) =>
      prev.map((d) => {
        if (d.id === targetId || (!targetId && d.status === 'closed')) {
          return {
            ...d,
            status: 'open',
            reopenedAt: timestamp,
            reopenedBy: ownerName,
            closedAt: null,
          };
        }
        return d;
      })
    );
    if (targetId) {
      syncSb(async (sb, sId, uId) => {
        await sb
          .from('drawer_sessions')
          .update({
            status: 'open',
            reopened_at: timestamp,
            reopened_by: uId,
            closed_at: null,
          })
          .eq('id', targetId)
          .eq('shop_id', sId);
      });
    }
    logAudit('REOPEN', 'drawer_sessions', `إعادة فتح الدرج المغلق بواسطة ${ownerName} في ${formattedTime} وتفعيل صلاحية إصدار الفواتير`, targetId);
  };

  // 11. استيراد الإكسيل
  const importDataFromExcel = (type: string, data: any[]) => {
    if (type === 'products') {
      const normalized = data.map((d) => ({ ...d, id: generateUuid() }));
      setProducts((prev) => [...normalized, ...prev]);
      syncSb(async (sb, sId) => {
        if (normalized.length > 0) {
          await sb.from('products').insert(
            normalized.map((p) => ({
              id: p.id,
              shop_id: sId,
              name: p.name,
              barcode: p.barcode || null,
              category_name: p.category || 'عام',
              cost_price: p.costPrice || 0,
              extra_cost: p.extraCost || 0,
              sale_price: p.salePrice || 0,
              opening_stock: p.openingStock || 0,
              current_stock: p.currentStock ?? p.openingStock ?? 0,
              min_stock_alert: p.minStockAlert || 5,
              unit: p.unit || 'قطعة',
            }))
          );
        }
      });
      logAudit('IMPORT', 'products', `استيراد ${normalized.length} صنف من ملف الإكسيل`);
    } else if (type === 'customers') {
      const normalized = data.map((d) => ({ ...d, id: generateUuid() }));
      setCustomers((prev) => [...normalized, ...prev]);
      syncSb(async (sb, sId) => {
        if (normalized.length > 0) {
          await sb.from('customers').insert(
            normalized.map((c) => ({
              id: c.id,
              shop_id: sId,
              name: c.name,
              phone: c.phone || null,
              credit_limit: c.creditLimit || 0,
              current_balance: c.currentBalance || 0,
              notes: c.notes || null,
            }))
          );
        }
      });
      logAudit('IMPORT', 'customers', `استيراد ${normalized.length} عميل من ملف الإكسيل`);
    } else if (type === 'suppliers') {
      const normalized = data.map((d) => ({ ...d, id: generateUuid() }));
      setSuppliers((prev) => [...normalized, ...prev]);
      syncSb(async (sb, sId) => {
        if (normalized.length > 0) {
          await sb.from('suppliers').insert(
            normalized.map((s) => ({
              id: s.id,
              shop_id: sId,
              name: s.name,
              company: s.company || null,
              phone: s.phone || null,
              owed_balance: s.owedBalance || 0,
              notes: s.notes || null,
            }))
          );
        }
      });
      logAudit('IMPORT', 'suppliers', `استيراد ${normalized.length} مورد من ملف الإكسيل`);
    } else if (type === 'opening_stock') {
      const updatedExisting: Product[] = [];
      const insertedNew: Product[] = [];
      setProducts((prev) => {
        const updated = [...prev];
        for (const item of data) {
          const matchIndex = updated.findIndex(
            (p) =>
              (item.barcode && p.barcode && p.barcode === item.barcode) ||
              p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );
          if (matchIndex >= 0) {
            const nextProd = {
              ...updated[matchIndex],
              openingStock: item.openingStock,
              currentStock: item.openingStock,
              costPrice: item.costPrice > 0 ? item.costPrice : updated[matchIndex].costPrice,
            };
            updated[matchIndex] = nextProd;
            updatedExisting.push(nextProd);
          } else {
            const newProd: Product = {
              id: generateUuid(),
              name: item.name,
              barcode: item.barcode || '',
              category: 'عام',
              costPrice: item.costPrice || 0,
              extraCost: 0,
              salePrice: Number(((item.costPrice || 0) * 1.25).toFixed(2)),
              openingStock: item.openingStock,
              currentStock: item.openingStock,
              minStockAlert: 5,
              unit: 'قطعة',
              createdAt: new Date().toISOString(),
            };
            updated.push(newProd);
            insertedNew.push(newProd);
          }
        }
        return updated;
      });
      syncSb(async (sb, sId) => {
        for (const p of updatedExisting) {
          await sb
            .from('products')
            .update({
              opening_stock: p.openingStock,
              current_stock: p.currentStock,
              cost_price: p.costPrice,
            })
            .eq('id', p.id)
            .eq('shop_id', sId);
        }
        if (insertedNew.length > 0) {
          await sb.from('products').insert(
            insertedNew.map((p) => ({
              id: p.id,
              shop_id: sId,
              name: p.name,
              barcode: p.barcode || null,
              category_name: p.category,
              cost_price: p.costPrice,
              extra_cost: p.extraCost,
              sale_price: p.salePrice,
              opening_stock: p.openingStock,
              current_stock: p.currentStock,
              min_stock_alert: p.minStockAlert,
              unit: p.unit,
            }))
          );
        }
      });
      logAudit('IMPORT', 'products', `استيراد وتحديث أرصدة المخزون الافتتاحي لـ ${data.length} صنف`);
    } else if (type === 'expenses') {
      const normalized = data.map((d) => ({ ...d, id: generateUuid() }));
      setExpenses((prev) => [...normalized, ...prev]);
      syncSb(async (sb, sId, uId) => {
        if (normalized.length > 0) {
          await sb.from('expenses').insert(
            normalized.map((e) => ({
              id: e.id,
              shop_id: sId,
              type: e.type || 'variable',
              category: e.category || 'عام',
              amount: e.amount || 0,
              payment_method: e.paymentMethod || 'cash',
              expense_date: e.date || new Date().toISOString().split('T')[0],
              notes: e.notes || null,
              created_by: uId,
            }))
          );
        }
      });
      logAudit('IMPORT', 'expenses', `استيراد ${normalized.length} بند مصروفات من ملف الإكسيل`);
    }
  };

  // 12. النسخ الاحتياطي
  const exportDatabaseJSON = () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      shopName,
      ownerName,
      products,
      customers,
      suppliers,
      supplierPayments,
      damagedItems,
      salesInvoices,
      purchaseInvoices,
      expenses,
      ownerWithdrawals,
      physicalCounts,
      drawerSessions,
      auditLogs,
    };
    return JSON.stringify(data, null, 2);
  };

  const restoreDatabaseJSON = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.products) setProducts(parsed.products);
      if (parsed.customers) setCustomers(parsed.customers);
      if (parsed.suppliers) setSuppliers(parsed.suppliers);
      if (parsed.supplierPayments) setSupplierPayments(parsed.supplierPayments);
      if (parsed.damagedItems) setDamagedItems(parsed.damagedItems);
      if (parsed.salesInvoices) setSalesInvoices(parsed.salesInvoices);
      if (parsed.purchaseInvoices) setPurchaseInvoices(parsed.purchaseInvoices);
      if (parsed.expenses) setExpenses(parsed.expenses);
      if (parsed.ownerWithdrawals) setOwnerWithdrawals(parsed.ownerWithdrawals);
      if (parsed.physicalCounts) setPhysicalCounts(parsed.physicalCounts);
      if (parsed.drawerSessions) setDrawerSessions(parsed.drawerSessions);
      if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
      logAudit('RESTORE', 'system', 'استعادة نسخة احتياطية كاملة لقاعدة البيانات');
      return true;
    } catch (e) {
      console.error('Failed to restore backup:', e);
      return false;
    }
  };

  const resetToSampleData = () => {
    setProducts(defaultProducts);
    setCustomers(defaultCustomers);
    setSuppliers(defaultSuppliers);
    setSupplierPayments(defaultSupplierPayments);
    setDamagedItems(defaultDamagedItems);
    setSalesInvoices([]);
    setPurchaseInvoices([]);
    setExpenses([]);
    setOwnerWithdrawals([]);
    setPhysicalCounts([]);
    setDrawerSessions([defaultDrawer]);
    logAudit('RESET', 'system', 'إعادة تعيين البيانات للوضع الافتراضي');
  };

  return (
    <ShopContext.Provider
      value={{
        shopId,
        shopName,
        ownerName,
        userEmail,
        userRole,
        isSupabaseConfigured,
        isAuthChecking,
        isAuthenticated,
        signOut,
        products: products.filter((p) => !p.deletedAt),
        customers: customers.filter((c) => !c.deletedAt),
        suppliers: suppliers.filter((s) => !s.deletedAt),
        supplierPayments,
        damagedItems,
        salesInvoices: salesInvoices.filter((s) => !s.deletedAt),
        purchaseInvoices: purchaseInvoices.filter((p) => !p.deletedAt),
        expenses: expenses.filter((e) => !e.deletedAt),
        ownerWithdrawals: ownerWithdrawals.filter((w) => !w.deletedAt),
        physicalCounts,
        drawerSessions,
        activeDrawer,
        auditLogs,
        addProduct,
        updateProduct,
        deleteProduct,
        addCustomer,
        updateCustomer,
        addCustomerPayment,
        addSupplier,
        updateSupplier,
        addSupplierPayment,
        createSaleInvoice,
        createSaleReturn,
        createPurchaseInvoice,
        addDamagedItem,
        addExpense,
        addOwnerWithdrawal,
        savePhysicalCountDraft,
        approvePhysicalCount,
        openNewDrawerSession,
        closeDrawerSession,
        reopenDrawerSession,
        importDataFromExcel,
        exportDatabaseJSON,
        restoreDatabaseJSON,
        resetToSampleData,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
