
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  calculateInvoiceTotals,
  calculateDrawerExpectedCash,
  checkCustomerCreditLimit,
  validateSaleReturnRequest,
  determineInvoiceReturnStatus,
  calculateReturnFinancialAdjustments,
} from '@/lib/calculations';
import { generateUniqueBarcode } from '@/lib/barcode-generator';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/motion/toast-provider';
import {
  assertSupabaseOk,
  generateUuid,
  loadShopDataFromSupabase,
  uploadInvoicePhotoToStorage,
} from '@/lib/supabase/shop-sync';
import {
  getDefaultHomeRoute,
  hasPermission,
  normalizeRoleKey,
  resolveEffectivePermissions,
  sanitizeExportDataByPermission,
  type PermissionKey,
  type RoleKey,
} from '@/lib/rbac';
import { isSessionTimedOut } from '@/lib/auth-security';

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
  createdBy?: string | null;
  createdByName?: string;
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
  createdBy?: string | null;
  createdByName?: string;
  createdAt: string;
}

export interface SaleInvoiceItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  returnedQuantity?: number;
  unitCost: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  lineCost: number;
  lineProfit: number;
}

export interface SaleReturnItem {
  id: string;
  invoiceItemId?: string | null;
  productId: string;
  productName: string;
  quantity: number;
  unitRefundPrice: number;
  unitCost: number;
  condition: 'sellable' | 'damaged';
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  invoiceId?: string | null;
  customerId?: string | null;
  refundAmount: number;
  refundMethod: 'cash' | 'wallet' | 'instapay' | 'credit';
  drawerSessionId?: string | null;
  reason: string;
  createdBy?: string | null;
  createdByName?: string;
  createdAt: string;
  items: SaleReturnItem[];
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
  createdBy?: string | null;
  createdByName?: string;
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
  createdBy?: string | null;
  createdByName?: string;
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
  createdBy?: string | null;
  createdByName?: string;
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
  createdBy?: string | null;
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
  openedByName?: string;
  closedByName?: string;
  reopenedAt?: string | null;
  reopenedBy?: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  tableName: string;
  details: string;
  changedBy?: string | null;
  actorName?: string;
  actorRole?: string;
  createdAt: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface ShopContextType {
  shopId: string | null;
  userId: string | null;
  shopName: string;
  ownerName: string;
  currentUserName: string;
  userEmail: string | null;
  userRole: RoleKey;
  permissions: Record<PermissionKey, boolean>;
  can: (permission: PermissionKey) => boolean;
  sessionTimeoutMinutes: number;
  updateSessionTimeout: (minutes: number) => Promise<ActionResult>;
  updateShopName: (newName: string) => Promise<ActionResult>;
  completeFastLogin: (payload: {
    user: { id: string; email?: string | null };
    session?: { access_token: string; refresh_token: string } | null;
    bootstrap: {
      shopId: string;
      shopName: string;
      ownerName: string;
      fullName: string;
      role: RoleKey;
      sessionTimeoutMinutes: number;
      permissions: Record<PermissionKey, boolean>;
    };
  }) => Promise<void>;
  isSupabaseConfigured: boolean;
  cloudStatus: 'connected' | 'error' | 'offline';
  cloudError: string | null;
  syncError: string | null;
  clearSyncError: () => void;
  isSaving: boolean;
  isInitialLoading: boolean;
  isAuthChecking: boolean;
  isAuthenticated: boolean;
  refreshFromCloud: () => Promise<boolean>;
  signOut: (reason?: string) => Promise<void>;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  damagedItems: DamagedItem[];
  salesInvoices: SaleInvoice[];
  salesReturns: SaleReturn[];
  purchaseInvoices: PurchaseInvoice[];
  expenses: Expense[];
  ownerWithdrawals: OwnerWithdrawal[];
  physicalCounts: PhysicalCount[];
  drawerSessions: DrawerSession[];
  activeDrawer: DrawerSession | null;
  auditLogs: AuditLog[];

  // Actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'currentStock'>) => Promise<ActionResult>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<ActionResult>;
  deleteProduct: (id: string) => Promise<ActionResult>;

  addCustomer: (
    customer: Omit<Customer, 'id' | 'createdAt' | 'currentBalance'> & { initialBalance?: number }
  ) => Promise<ActionResult & { customer?: Customer }>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<ActionResult>;
  addCustomerPayment: (
    customerId: string,
    amount: number,
    method: 'cash' | 'wallet' | 'instapay',
    notes?: string
  ) => Promise<ActionResult>;

  addSupplier: (
    supplier: Omit<Supplier, 'id' | 'createdAt' | 'owedBalance'> & { initialBalance?: number }
  ) => Promise<ActionResult & { supplier?: Supplier }>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<ActionResult>;
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
  ) => Promise<ActionResult>;

  createSaleInvoice: (data: {
    customerId?: string | null;
    customerName?: string;
    items: Array<{ productId: string; quantity: number; unitPrice?: number; discount?: number }>;
    overallDiscount?: number;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'split';
    paidAmount: number;
    notes?: string;
  }) => Promise<{ ok: boolean; invoice: SaleInvoice | null; warning?: string; error?: string }>;

  createSaleReturn: (data: {
    invoiceId: string;
    invoiceItemId: string;
    productId: string;
    quantity: number;
    refundAmount: number;
    refundMethod: 'cash' | 'wallet' | 'instapay' | 'credit';
    isSellable: boolean;
    reason: string;
  }) => Promise<ActionResult>;

  createPurchaseInvoice: (data: {
    supplierId?: string | null;
    supplierName: string;
    items: Array<{
      productId?: string;
      productName?: string;
      isNew?: boolean;
      quantity: number;
      unitCost: number;
      salePrice?: number;
    }>;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'bank';
    paidAmount: number;
    invoicePhotoUrl?: string | null;
    notes?: string;
  }) => Promise<ActionResult>;

  addDamagedItem: (data: {
    productId?: string | null;
    productName?: string;
    quantity: number;
    unitCost?: number;
    reason: string;
    date?: string;
    notes?: string;
  }) => Promise<ActionResult>;

  addExpense: (data: Omit<Expense, 'id' | 'createdAt'>) => Promise<ActionResult>;
  addOwnerWithdrawal: (data: Omit<OwnerWithdrawal, 'id' | 'createdAt' | 'ownerName'>) => Promise<ActionResult>;

  savePhysicalCountDraft: (
    items: Array<{ productId: string; countedStock: number }>,
    notes?: string
  ) => Promise<ActionResult & { countId?: string }>;
  approvePhysicalCount: (countId: string) => Promise<ActionResult>;

  openNewDrawerSession: (openingCash: number) => Promise<ActionResult>;
  closeDrawerSession: (actualCash: number, closingNotes?: string) => Promise<ActionResult>;
  reopenDrawerSession: (sessionId?: string) => Promise<ActionResult>;

  importDataFromExcel: (type: string, data: any[]) => Promise<ActionResult>;
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
    currentStock: 3,
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
    currentBalance: 1650,
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
  const { successToast, errorToast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const isSupabaseConfigured = Boolean(supabase);

  const [shopId, setShopId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<RoleKey>('admin');
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(() =>
    resolveEffectivePermissions({ role: 'admin' })
  );
  const [currentUserName, setCurrentUserName] = useState('كريم');
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(120);
  const lastActivityRef = useRef<number>(Date.now());
  const [shopName, setShopName] = useState('محل شفرة');
  const [ownerName, setOwnerName] = useState('كريم');
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(Boolean(supabase));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!supabase);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const can = useCallback(
    (perm: PermissionKey) => hasPermission(permissions, perm),
    [permissions]
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [damagedItems, setDamagedItems] = useState<DamagedItem[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SaleInvoice[]>([]);
  const [salesReturns, setSalesReturns] = useState<SaleReturn[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ownerWithdrawals, setOwnerWithdrawals] = useState<OwnerWithdrawal[]>([]);
  const [physicalCounts, setPhysicalCounts] = useState<PhysicalCount[]>([]);
  const [drawerSessions, setDrawerSessions] = useState<DrawerSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const cloudStatus: 'connected' | 'error' | 'offline' = !isSupabaseConfigured
    ? 'offline'
    : cloudError || (isAuthenticated && !shopId && !isAuthChecking)
    ? 'error'
    : 'connected';

  const clearSyncError = useCallback(() => setSyncError(null), []);

  const clearShopState = useCallback(() => {
    setShopId(null);
    setCloudError(null);
    setSyncError(null);
    setProducts([]);
    setCustomers([]);
    setSuppliers([]);
    setSupplierPayments([]);
    setDamagedItems([]);
    setSalesInvoices([]);
    setSalesReturns([]);
    setPurchaseInvoices([]);
    setExpenses([]);
    setOwnerWithdrawals([]);
    setPhysicalCounts([]);
    setDrawerSessions([]);
    setAuditLogs([]);
  }, []);

  const signOut = useCallback(async (reason?: string) => {
    try {
      if (typeof window !== 'undefined' && userId) {
        sessionStorage.removeItem(`shafra_snapshot_${userId}`);
      }
    } catch {
      // تجاهل أخطاء التخزين المؤقت
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearShopState();
    setUserId(null);
    setUserEmail(null);
    setIsAuthenticated(false);
    const target =
      reason === 'deactivated'
        ? '/login?deactivated=1'
        : reason === 'timeout'
        ? '/login?timeout=1'
        : '/login';
    router.replace(target);
  }, [supabase, clearShopState, router, userId]);

  const inFlightHydrationRef = useRef<{ uid: string; promise: Promise<boolean> } | null>(null);
  const loadedUserRef = useRef<string | null>(null);

  const applyHydratedPayload = useCallback(
    (p: NonNullable<Awaited<ReturnType<typeof loadShopDataFromSupabase>>['payload']>, email?: string | null) => {
      setShopId(p.shopId);
      setShopName(p.shopName);
      setOwnerName(p.ownerName);
      setCurrentUserName(p.currentUserName);
      setUserRole(p.userRole);
      setPermissions(p.permissions);
      setSessionTimeoutMinutes(p.sessionTimeoutMinutes || 120);
      setUserEmail(email || null);
      setCloudError(null);
      setProducts(p.products);
      setCustomers(p.customers);
      setSuppliers(p.suppliers);
      setSupplierPayments(p.supplierPayments);
      setDamagedItems(p.damagedItems);
      setSalesInvoices(p.salesInvoices);
      setSalesReturns(p.salesReturns);
      setPurchaseInvoices(p.purchaseInvoices);
      setExpenses(p.expenses);
      setOwnerWithdrawals(p.ownerWithdrawals);
      setPhysicalCounts(p.physicalCounts);
      setDrawerSessions(p.drawerSessions);
      setAuditLogs(p.auditLogs);
      setIsLoaded(true);
    },
    []
  );

  const hydrateFromSupabase = useCallback(
    async (uid: string, email?: string | null, opts?: { silent?: boolean }): Promise<boolean> => {
      if (!supabase) return false;
      if (inFlightHydrationRef.current && inFlightHydrationRef.current.uid === uid) {
        return inFlightHydrationRef.current.promise;
      }

      // تحميل فوري من ذاكرة الجلسة المؤقتة لنفس المستخدم لإزالة الانتظار الطويل للـ skeleton ثم التحديث بالخلفية
      let usedFastSnapshot = false;
      if (!opts?.silent && loadedUserRef.current !== uid && typeof window !== 'undefined') {
        try {
          const cachedRaw = sessionStorage.getItem(`shafra_snapshot_${uid}`);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (parsed?.shopId && Array.isArray(parsed.customers) && Array.isArray(parsed.suppliers)) {
              applyHydratedPayload(parsed, email);
              setIsAuthChecking(false);
              usedFastSnapshot = true;
            }
          }
        } catch {
          // تجاهل أي بيانات مؤقتة تالفة
        }
      }

      if (!opts?.silent && !usedFastSnapshot) {
        setIsAuthChecking(true);
      }

      const task = (async () => {
        try {
          const result = await loadShopDataFromSupabase(supabase, uid);
          if (result.deactivated) {
            try {
              if (typeof window !== 'undefined') sessionStorage.removeItem(`shafra_snapshot_${uid}`);
            } catch {
              // ignore
            }
            errorToast(result.error || 'تم إيقاف هذا الحساب من قِبل مدير النظام');
            await supabase.auth.signOut();
            clearShopState();
            loadedUserRef.current = null;
            setUserId(null);
            setUserEmail(null);
            setIsAuthenticated(false);
            router.replace('/login?deactivated=1');
            return false;
          }
          if (result.payload) {
            loadedUserRef.current = uid;
            applyHydratedPayload(result.payload, email);
            try {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem(`shafra_snapshot_${uid}`, JSON.stringify(result.payload));
              }
            } catch {
              // تجاهل امتلاء الذاكرة المؤقتة
            }
            return true;
          } else {
            setShopId(null);
            setCloudError(result.error || 'فشل تحميل بيانات المتجر من Supabase');
            return false;
          }
        } catch (err: any) {
          setShopId(null);
          setCloudError(err?.message || 'حدث خطأ أثناء الاتصال بـ Supabase');
          return false;
        } finally {
          inFlightHydrationRef.current = null;
          setIsLoaded(true);
          setIsAuthChecking(false);
        }
      })();

      inFlightHydrationRef.current = { uid, promise: task };
      return task;
    },
    [supabase, clearShopState, router, errorToast, applyHydratedPayload]
  );

  const refreshFromCloud = useCallback(async (): Promise<boolean> => {
    if (!supabase || !userId) return false;
    return hydrateFromSupabase(userId, userEmail, { silent: true });
  }, [supabase, userId, userEmail, hydrateFromSupabase]);

  const completeFastLogin = useCallback(
    async (payload: {
      user: { id: string; email?: string | null };
      session?: { access_token: string; refresh_token: string } | null;
      bootstrap: {
        shopId: string;
        shopName: string;
        ownerName: string;
        fullName: string;
        role: RoleKey;
        sessionTimeoutMinutes: number;
        permissions: Record<PermissionKey, boolean>;
      };
    }) => {
      const { user, session, bootstrap } = payload;
      loadedUserRef.current = user.id;
      setUserId(user.id);
      setUserEmail(user.email || null);
      setShopId(bootstrap.shopId);
      setShopName(bootstrap.shopName);
      setOwnerName(bootstrap.ownerName);
      setCurrentUserName(bootstrap.fullName);
      setUserRole(bootstrap.role);
      setPermissions(bootstrap.permissions);
      setSessionTimeoutMinutes(bootstrap.sessionTimeoutMinutes || 120);
      setCloudError(null);
      setIsAuthenticated(true);
      setIsAuthChecking(false);
      setIsLoaded(true);

      // مزامنة عميل المتصفح وجلب الجداول في الخلفية دون تأخير الانتقال إلى لوحة التحكم
      if (supabase) {
        if (session?.access_token && session?.refresh_token) {
          void supabase.auth
            .setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            })
            .catch(() => null);
        }
        void hydrateFromSupabase(user.id, user.email, { silent: true });
      }
    },
    [supabase, hydrateFromSupabase]
  );

  const updateShopName = useCallback(
    async (newName: string): Promise<ActionResult> => {
      const trimmed = newName.trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        return { ok: false, error: 'يجب أن يكون اسم المحل بين حرفين و 80 حرفاً.' };
      }

      if (userRole !== 'admin') {
        return { ok: false, error: 'تعديل اسم المحل متاح لمدير النظام (Admin) فقط.' };
      }

      if (!supabase) {
        setShopName(trimmed);
        return { ok: true };
      }

      try {
        const res = await fetch('/api/settings/shop', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shopName: trimmed }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'تعذر حفظ اسم المحل' };
        }
        const savedName = data.shopName || trimmed;
        setShopName(savedName);
        if (typeof window !== 'undefined' && userId) {
          try {
            const raw = sessionStorage.getItem(`shafra_snapshot_${userId}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              parsed.shopName = savedName;
              sessionStorage.setItem(`shafra_snapshot_${userId}`, JSON.stringify(parsed));
            }
          } catch {
            // ignore
          }
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لحفظ اسم المحل' };
      }
    },
    [supabase, userRole, userId]
  );

  // التحقق من مهلة الجلسة وحالة تفعيل الحساب بشكل دوري عند تفعيل Supabase
  useEffect(() => {
    if (!supabase || !isAuthenticated || !userId) return;

    const bumpActivity = () => {
      lastActivityRef.current = Date.now();
    };
    lastActivityRef.current = Date.now();

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, bumpActivity, { passive: true }));

    const interval = setInterval(async () => {
      if (isSessionTimedOut(lastActivityRef.current, sessionTimeoutMinutes)) {
        errorToast('انتهت مهلة الجلسة بسبب عدم النشاط، يرجى تسجيل الدخول مرة أخرى');
        await signOut('timeout');
        return;
      }
      // التحقق الفوري من حالة التفعيل على الخادم
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .maybeSingle();
      if (prof && prof.is_active === false) {
        errorToast('تم إيقاف هذا الحساب من قِبل مدير النظام');
        await signOut('deactivated');
      }
    }, 30000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bumpActivity));
      clearInterval(interval);
    };
  }, [supabase, isAuthenticated, userId, sessionTimeoutMinutes, signOut, errorToast]);

  // التحقق من جلسة Supabase وتحميل بيانات المتجر المعزول
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
          setSalesReturns(parsed.salesReturns || []);
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
              details: 'تم تجهيز نظام محل شفرة بنجاح',
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

    // استخدام getSession أولاً لبدء جلب الجداول فوراً بدون تأخير إضافي لجولة getUser
    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      const sessionUser = data?.session?.user;
      if (sessionUser) {
        setUserId(sessionUser.id);
        setUserEmail(sessionUser.email || null);
        setIsAuthenticated(true);
        void hydrateFromSupabase(sessionUser.id, sessionUser.email);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!isMounted) return;
      const user = userData?.user;
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
        loadedUserRef.current = null;
        setUserId(null);
        setUserEmail(null);
        setIsAuthenticated(false);
        clearShopState();
        setIsAuthChecking(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUserId(user.id);
        setUserEmail(user.email || null);
        setIsAuthenticated(true);
        const alreadyLoadedSameUser = loadedUserRef.current === user.id;
        void hydrateFromSupabase(user.id, user.email, { silent: alreadyLoadedSameUser });
      }
    });

    return () => {
      isMounted = false;
      authSub.subscription.unsubscribe();
    };
  }, [supabase, clearShopState, hydrateFromSupabase]);

  // توجيه غير المسجلين إلى صفحة الدخول، والمسجلين إلى الصفحة الافتراضية المسموحة لدورهم
  useEffect(() => {
    if (!supabase || isAuthChecking) return;
    if (!isAuthenticated && pathname !== '/login' && pathname !== '/auth/callback') {
      router.replace('/login');
    } else if (isAuthenticated && pathname === '/login') {
      router.replace(getDefaultHomeRoute(permissions));
    }
  }, [supabase, isAuthChecking, isAuthenticated, pathname, router, permissions]);

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
        salesReturns,
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
    salesReturns,
    purchaseInvoices,
    expenses,
    ownerWithdrawals,
    physicalCounts,
    drawerSessions,
    auditLogs,
  ]);

  const denyIfUnauthorized = (perm: PermissionKey): ActionResult | null => {
    if (!can(perm)) {
      const msg = 'غير مصرح لك بتنفيذ هذا الإجراء حسب صلاحيات حسابك';
      errorToast(msg);
      return { ok: false, error: msg };
    }
    return null;
  };

  const updateSessionTimeout = async (minutes: number): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('settings.manage');
    if (denied) return denied;
    const safeMinutes = Math.max(5, Math.min(1440, Math.round(minutes || 120)));
    if (!supabase) {
      setSessionTimeoutMinutes(safeMinutes);
      successToast(`تم تحديث مهلة الجلسة إلى ${safeMinutes} دقيقة`);
      return { ok: true };
    }
    try {
      const res = await fetch('/api/settings/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionTimeoutMinutes: safeMinutes }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        errorToast(json.error || 'تعذر حفظ مهلة الجلسة');
        return { ok: false, error: json.error || 'تعذر حفظ مهلة الجلسة' };
      }
      setSessionTimeoutMinutes(safeMinutes);
      await refreshFromCloud();
      successToast(`تم تحديث مهلة الجلسة إلى ${safeMinutes} دقيقة`);
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'تعذر الاتصال بالخادم';
      errorToast(msg);
      return { ok: false, error: msg };
    }
  };

  // تنفيذ حقيقي ومؤكد لعمليات الكتابة في Supabase مع إعادة القراءة وإشعارات التوست
  const runSupabaseWrite = useCallback(
    async (
      actionLabel: string,
      fn: (sb: NonNullable<typeof supabase>, sId: string, uId: string) => Promise<void>,
      successMsg?: string
    ): Promise<ActionResult> => {
      if (!supabase) return { ok: true };
      if (!shopId || !userId) {
        const msg =
          cloudError ||
          'تعذر الحفظ: الحساب غير مربوط بمتجر أو صلاحيات Supabase غير مفعلة. يرجى مراجعة الإعدادات.';
        setSyncError(msg);
        errorToast(msg);
        return { ok: false, error: msg };
      }
      setIsSaving(true);
      setSyncError(null);
      try {
        await fn(supabase, shopId, userId);
        await hydrateFromSupabase(userId, userEmail, { silent: true });
        successToast(successMsg || `تم ${actionLabel} وحفظ البيانات بنجاح`);
        return { ok: true };
      } catch (err: any) {
        const msg = err?.message || `فشل تنفيذ "${actionLabel}" في قاعدة البيانات`;
        console.error(`Supabase write failed (${actionLabel}):`, err);
        setSyncError(msg);
        errorToast(msg);
        return { ok: false, error: msg };
      } finally {
        setIsSaving(false);
      }
    },
    [supabase, shopId, userId, userEmail, cloudError, hydrateFromSupabase, successToast, errorToast]
  );

  const activeDrawer = drawerSessions.find((s) => s.status === 'open') || null;

  const insertAuditRow = async (
    sb: NonNullable<typeof supabase>,
    sId: string,
    uId: string,
    action: string,
    tableName: string,
    details: string,
    recordId?: string
  ) => {
    const id = generateUuid();
    await sb.from('audit_logs').insert({
      id,
      shop_id: sId,
      table_name: tableName,
      record_id: recordId || id,
      action,
      new_data: { details },
      changed_by: uId,
      actor_name: currentUserName,
      actor_role: userRole,
    });
  };

  const pushLocalAudit = (action: string, tableName: string, details: string) => {
    const newLog: AuditLog = {
      id: generateUuid(),
      action,
      tableName,
      details,
      changedBy: userId || 'local-user',
      actorName: currentUserName,
      actorRole: userRole,
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 299)]);
  };

  // 1. المنتجات
  const addProduct = async (
    data: Omit<Product, 'id' | 'createdAt' | 'currentStock'>
  ): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('products.create');
    if (denied) return denied;
    const prodId = generateUuid();
    const newProduct: Product = {
      ...data,
      id: prodId,
      currentStock: data.openingStock,
      createdAt: new Date().toISOString(),
    };

    if (!supabase) {
      setProducts((prev) => [newProduct, ...prev]);
      pushLocalAudit('CREATE', 'products', `إضافة منتج جديد: ${newProduct.name}`);
      successToast(`تم إضافة الصنف "${newProduct.name}" بنجاح`);
      return { ok: true };
    }

    const prevProducts = products;
    setProducts((prev) => [newProduct, ...prev]);

    const res = await runSupabaseWrite('إضافة منتج', async (sb, sId, uId) => {
      assertSupabaseOk(
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
        }),
        'إضافة المنتج'
      );
      await insertAuditRow(sb, sId, uId, 'CREATE', 'products', `إضافة منتج جديد: ${newProduct.name}`, prodId);
    });
    if (!res.ok) setProducts(prevProducts);
    return res;
  };

  const updateProduct = async (id: string, updates: Partial<Product>): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('products.edit');
    if (denied) return denied;
    if (!supabase) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      pushLocalAudit('UPDATE', 'products', `تعديل بيانات المنتج معرف: ${id}`);
      successToast('تم حفظ تعديل الصنف بنجاح');
      return { ok: true };
    }

    const prevProducts = products;
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));

    const res = await runSupabaseWrite('تعديل منتج', async (sb, sId, uId) => {
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
      assertSupabaseOk(
        await sb.from('products').update(dbUpdates).eq('id', id).eq('shop_id', sId),
        'تعديل المنتج'
      );
      await insertAuditRow(sb, sId, uId, 'UPDATE', 'products', `تعديل بيانات المنتج معرف: ${id}`, id);
    });
    if (!res.ok) setProducts(prevProducts);
    return res;
  };

  const deleteProduct = async (id: string): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('products.delete');
    if (denied) return denied;
    const deletedAt = new Date().toISOString();
    if (!supabase) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, deletedAt } : p)));
      pushLocalAudit('DELETE', 'products', `حذف منتج معرف: ${id}`);
      successToast('تم حذف الصنف بنجاح');
      return { ok: true };
    }

    const prevProducts = products;
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, deletedAt } : p)));

    const res = await runSupabaseWrite('حذف منتج', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb.from('products').update({ deleted_at: deletedAt }).eq('id', id).eq('shop_id', sId),
        'حذف المنتج'
      );
      await insertAuditRow(sb, sId, uId, 'DELETE', 'products', `حذف منتج (Soft Delete) معرف: ${id}`, id);
    });
    if (!res.ok) setProducts(prevProducts);
    return res;
  };

  // 2. العملاء
  const addCustomer = async (
    data: Omit<Customer, 'id' | 'createdAt' | 'currentBalance'> & { initialBalance?: number }
  ): Promise<ActionResult & { customer?: Customer }> => {
    const denied = denyIfUnauthorized('customers.create');
    if (denied) return denied;
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

    if (!supabase) {
      setCustomers((prev) => [newCustomer, ...prev]);
      pushLocalAudit('CREATE', 'customers', `إضافة عميل جديد: ${newCustomer.name}`);
      successToast(`تم إضافة العميل "${newCustomer.name}"`);
      return { ok: true, customer: newCustomer };
    }

    const prevCustomers = customers;
    setCustomers((prev) => [newCustomer, ...prev]);

    const res = await runSupabaseWrite('إضافة عميل', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb.from('customers').insert({
          id: custId,
          shop_id: sId,
          name: newCustomer.name,
          phone: newCustomer.phone || null,
          credit_limit: newCustomer.creditLimit,
          current_balance: newCustomer.currentBalance,
          notes: newCustomer.notes || null,
        }),
        'إضافة العميل'
      );
      await insertAuditRow(sb, sId, uId, 'CREATE', 'customers', `إضافة عميل جديد: ${newCustomer.name}`, custId);
    });
    if (!res.ok) setCustomers(prevCustomers);
    return { ...res, customer: res.ok ? newCustomer : undefined };
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('customers.edit');
    if (denied) return denied;
    if (!supabase) {
      setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      return { ok: true };
    }

    return runSupabaseWrite('تعديل عميل', async (sb, sId) => {
      const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.creditLimit !== undefined) dbUpdates.credit_limit = updates.creditLimit;
      if (updates.currentBalance !== undefined) dbUpdates.current_balance = updates.currentBalance;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      assertSupabaseOk(
        await sb.from('customers').update(dbUpdates).eq('id', id).eq('shop_id', sId),
        'تعديل بيانات العميل'
      );
    });
  };

  const addCustomerPayment = async (
    customerId: string,
    amount: number,
    method: 'cash' | 'wallet' | 'instapay',
    notes?: string
  ): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('customers.collect_payment');
    if (denied) return denied;
    const targetCust = customers.find((c) => c.id === customerId);
    const updatedBal = targetCust
      ? Number(Math.max(0, targetCust.currentBalance - amount).toFixed(2))
      : 0;

    let updatedDrawerPayload: Record<string, number> | null = null;
    if (activeDrawer) {
      const newCashDebt =
        method === 'cash' ? activeDrawer.cashDebtPayments + amount : activeDrawer.cashDebtPayments;
      const newWallet =
        method === 'wallet' ? activeDrawer.walletTotal + amount : activeDrawer.walletTotal;
      const newInstapay =
        method === 'instapay' ? activeDrawer.instapayTotal + amount : activeDrawer.instapayTotal;
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
    }

    if (!supabase) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, currentBalance: updatedBal } : c))
      );
      if (activeDrawer && updatedDrawerPayload) {
        setDrawerSessions((prev) =>
          prev.map((d) =>
            d.id === activeDrawer.id
              ? {
                  ...d,
                  cashDebtPayments: updatedDrawerPayload!.cash_customer_debt_payments,
                  walletTotal: updatedDrawerPayload!.wallet_total,
                  instapayTotal: updatedDrawerPayload!.instapay_total,
                  expectedCash: updatedDrawerPayload!.expected_cash,
                }
              : d
          )
        );
      }
      pushLocalAudit('PAYMENT', 'customers', `تحصيل سداد دين عميل بقيمة ${amount} ج.م`);
      return { ok: true };
    }

    const activeDrawerId = activeDrawer?.id || null;
    return runSupabaseWrite('تحصيل سداد عميل', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb
          .from('customers')
          .update({ current_balance: updatedBal })
          .eq('id', customerId)
          .eq('shop_id', sId),
        'تحديث رصيد العميل'
      );
      assertSupabaseOk(
        await sb.from('customer_transactions').insert({
          shop_id: sId,
          customer_id: customerId,
          transaction_type: 'payment',
          amount: -Math.abs(amount),
          payment_method: method,
          notes: notes || null,
          created_by: uId,
        }),
        'تسجيل حركة العميل'
      );
      if (activeDrawerId && updatedDrawerPayload) {
        assertSupabaseOk(
          await sb
            .from('drawer_sessions')
            .update(updatedDrawerPayload)
            .eq('id', activeDrawerId)
            .eq('shop_id', sId),
          'تحديث الدرج'
        );
      }
      await insertAuditRow(
        sb,
        sId,
        uId,
        'PAYMENT',
        'customers',
        `تحصيل سداد دين عميل بقيمة ${amount} ج.م بطريقة ${method} (${notes || ''})`,
        customerId
      );
    });
  };

  // 3. الموردين
  const addSupplier = async (
    data: Omit<Supplier, 'id' | 'createdAt' | 'owedBalance'> & { initialBalance?: number }
  ): Promise<ActionResult & { supplier?: Supplier }> => {
    const denied = denyIfUnauthorized('suppliers.manage');
    if (denied) return denied;
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

    if (!supabase) {
      setSuppliers((prev) => [newSupplier, ...prev]);
      pushLocalAudit('CREATE', 'suppliers', `إضافة مورد جديد: ${newSupplier.name}`);
      return { ok: true, supplier: newSupplier };
    }

    const res = await runSupabaseWrite('إضافة مورد', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb.from('suppliers').insert({
          id: suppId,
          shop_id: sId,
          name: newSupplier.name,
          company: newSupplier.company || null,
          phone: newSupplier.phone || null,
          owed_balance: newSupplier.owedBalance,
          notes: newSupplier.notes || null,
        }),
        'إضافة المورد'
      );
      await insertAuditRow(sb, sId, uId, 'CREATE', 'suppliers', `إضافة مورد جديد: ${newSupplier.name}`, suppId);
    });
    return { ...res, supplier: res.ok ? newSupplier : undefined };
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<ActionResult> => {
    if (!supabase) {
      setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
      return { ok: true };
    }

    return runSupabaseWrite('تعديل مورد', async (sb, sId) => {
      const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.company !== undefined) dbUpdates.company = updates.company;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.owedBalance !== undefined) dbUpdates.owed_balance = updates.owedBalance;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      assertSupabaseOk(
        await sb.from('suppliers').update(dbUpdates).eq('id', id).eq('shop_id', sId),
        'تعديل بيانات المورد'
      );
    });
  };

  const addSupplierPayment = async (
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
  ): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('suppliers.manage');
    if (denied) return denied;
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

    if (amount <= 0) return { ok: false, error: 'يجب إدخال مبلغ سداد صحيح أكبر من صفر' };

    const supplier = suppliers.find((s) => s.id === targetSupplierId);
    const supplierName = supplier?.name || 'مورد';
    const nextOwedBalance = supplier
      ? Number((supplier.owedBalance - amount).toFixed(2))
      : -amount;

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
    }

    if (!supabase) {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === targetSupplierId ? { ...s, owedBalance: nextOwedBalance } : s))
      );
      setSupplierPayments((prev) => [newPayment, ...prev]);
      if (activeDrawer && updatedSupCash) {
        setDrawerSessions((prev) =>
          prev.map((d) =>
            d.id === activeDrawer.id
              ? {
                  ...d,
                  cashSupplierPayments: updatedSupCash!.cash_supplier_payments,
                  expectedCash: updatedSupCash!.expected_cash,
                }
              : d
          )
        );
      }
      pushLocalAudit('PAYMENT', 'suppliers', `سداد دفعة للمورد ${supplierName} بقيمة ${amount} ج.م`);
      return { ok: true };
    }

    const activeDrawerId = activeDrawer?.id || null;
    return runSupabaseWrite('سداد دفعة للمورد', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb
          .from('suppliers')
          .update({ owed_balance: nextOwedBalance })
          .eq('id', targetSupplierId)
          .eq('shop_id', sId),
        'تحديث رصيد المورد'
      );
      assertSupabaseOk(
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
          created_by_name: currentUserName,
        }),
        'تسجيل سداد المورد'
      );
      if (activeDrawerId && updatedSupCash) {
        assertSupabaseOk(
          await sb
            .from('drawer_sessions')
            .update(updatedSupCash)
            .eq('id', activeDrawerId)
            .eq('shop_id', sId),
          'تحديث الدرج'
        );
      }
      await insertAuditRow(
        sb,
        sId,
        uId,
        'PAYMENT',
        'suppliers',
        `سداد دفعة للمورد ${supplierName} بقيمة ${amount} ج.م بطريقة ${method} بتاريخ ${date} (${notes || ''})`,
        spayId
      );
    });
  };

  // 4. فاتورة البيع
  const createSaleInvoice = async (data: {
    customerId?: string | null;
    customerName?: string;
    items: Array<{ productId: string; quantity: number; unitPrice?: number; discount?: number }>;
    overallDiscount?: number;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'split';
    paidAmount: number;
    notes?: string;
  }): Promise<{ ok: boolean; invoice: SaleInvoice | null; warning?: string; error?: string }> => {
    const denied = denyIfUnauthorized('pos.create');
    if (denied) return { ok: false, invoice: null, error: denied.error };

    const hasAnyDiscount =
      (data.overallDiscount || 0) > 0 || data.items.some((i) => (i.discount || 0) > 0);
    if (hasAnyDiscount && !can('pos.apply_discount')) {
      const msg = 'لا تملك صلاحية تطبيق خصم على الفاتورة';
      errorToast(msg);
      return { ok: false, invoice: null, error: msg };
    }

    if (!activeDrawer || activeDrawer.status !== 'open') {
      return {
        ok: false,
        invoice: null,
        warning: 'الدرج مقفل حالياً! لا يمكن إنشاء فواتير بيع جديدة حتى يتم إعادة فتح الدرج من قبل المالك.',
        error: 'الدرج مقفل حالياً! لا يمكن إنشاء فواتير بيع جديدة قبل فتح الدرج.',
      };
    }

    let warning: string | undefined;
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

      if (prod.currentStock < item.quantity) {
        warning = `تنبيه: الكمية المباعة من "${prod.name}" أكبر من الرصيد المتوفر (${prod.currentStock})، أصبح المخزون سالباً!`;
      }

      processedItems.push({
        id: generateUuid(),
        productId: prod.id,
        productName: prod.name,
        barcode: prod.barcode,
        quantity: item.quantity,
        returnedQuantity: 0,
        unitCost,
        unitPrice,
        discount,
        lineTotal,
        lineCost,
        lineProfit,
      });
    }

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
      customerName:
        data.customerName ||
        (data.customerId ? customers.find((c) => c.id === data.customerId)?.name || 'عميل' : 'عميل نقدي'),
      items: processedItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      totalAmount: totals.totalAmount,
      totalCost: totals.totalCost,
      grossProfit: totals.grossProfit,
      paidAmount: totals.paidAmount,
      remainingAmount: totals.remainingDebt,
      paymentMethod: data.paymentMethod,
      drawerSessionId: activeDrawer.id,
      notes: data.notes || '',
      status: 'completed',
      createdBy: userId,
      createdByName: currentUserName,
      createdAt: new Date().toISOString(),
    };

    const stockUpdates = processedItems.map((soldItem) => {
      const prod = products.find((p) => p.id === soldItem.productId)!;
      return {
        id: prod.id,
        nextStock: Number((prod.currentStock - soldItem.quantity).toFixed(2)),
      };
    });

    let nextCustomerBalance: number | null = null;
    if (data.customerId && totals.remainingDebt > 0) {
      const targetCust = customers.find((c) => c.id === data.customerId);
      if (targetCust) {
        nextCustomerBalance = Number((targetCust.currentBalance + totals.remainingDebt).toFixed(2));
        const check = checkCustomerCreditLimit(
          targetCust.currentBalance,
          totals.remainingDebt,
          targetCust.creditLimit
        );
        if (check.isExceeded) {
          warning =
            (warning ? warning + ' | ' : '') +
            `تنبيه ائتمان: العميل تجاوز حد الائتمان بمبلغ ${check.excessAmount} ج.م!`;
        }
      }
    }

    const isCash = data.paymentMethod === 'cash';
    const isWallet = data.paymentMethod === 'wallet';
    const isInstapay = data.paymentMethod === 'instapay';
    const cashAdd = isCash ? totals.paidAmount : data.paymentMethod === 'split' ? totals.paidAmount : 0;
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

    const drawerUpdatePayload = {
      cash_sales: nextCashSales,
      wallet_total: nextWalletTotal,
      instapay_total: nextInstapayTotal,
      expected_cash: expected,
    };

    if (!supabase) {
      setProducts((prev) =>
        prev.map((p) => {
          const upd = stockUpdates.find((u) => u.id === p.id);
          return upd ? { ...p, currentStock: upd.nextStock } : p;
        })
      );
      if (data.customerId && nextCustomerBalance !== null) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === data.customerId ? { ...c, currentBalance: nextCustomerBalance! } : c))
        );
      }
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
      setSalesInvoices((prev) => [newInvoice, ...prev]);
      pushLocalAudit('CREATE', 'sales_invoices', `إنشاء فاتورة بيع ${invoiceNumber}`);
      return { ok: true, invoice: newInvoice, warning };
    }

    const activeDrawerId = activeDrawer.id;
    const writeRes = await runSupabaseWrite('حفظ فاتورة البيع', async (sb, sId, uId) => {
      assertSupabaseOk(
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
          created_by_name: currentUserName,
        }),
        'حفظ رأس فاتورة البيع'
      );

      if (processedItems.length > 0) {
        assertSupabaseOk(
          await sb.from('sales_invoice_items').insert(
            processedItems.map((it) => ({
              id: it.id,
              shop_id: sId,
              invoice_id: invId,
              product_id: it.productId,
              product_name: it.productName,
              barcode: it.barcode || null,
              quantity: it.quantity,
              returned_quantity: 0,
              unit_cost: it.unitCost,
              unit_price: it.unitPrice,
              discount: it.discount,
              line_total: it.lineTotal,
              line_cost: it.lineCost,
              line_profit: it.lineProfit,
            }))
          ),
          'حفظ بنود فاتورة البيع'
        );
      }

      for (const upd of stockUpdates) {
        assertSupabaseOk(
          await sb
            .from('products')
            .update({ current_stock: upd.nextStock })
            .eq('id', upd.id)
            .eq('shop_id', sId),
          'تحديث رصيد المنتج'
        );
      }

      if (data.customerId && nextCustomerBalance !== null) {
        assertSupabaseOk(
          await sb
            .from('customers')
            .update({ current_balance: nextCustomerBalance })
            .eq('id', data.customerId)
            .eq('shop_id', sId),
          'تحديث مديونية العميل'
        );
      }

      assertSupabaseOk(
        await sb
          .from('drawer_sessions')
          .update(drawerUpdatePayload)
          .eq('id', activeDrawerId)
          .eq('shop_id', sId),
        'تحديث نقدية الدرج'
      );

      await insertAuditRow(
        sb,
        sId,
        uId,
        'CREATE',
        'sales_invoices',
        `إنشاء فاتورة بيع ${invoiceNumber} بمبلغ ${totals.totalAmount} ج.م`,
        invId
      );
    });

    if (!writeRes.ok) {
      return { ok: false, invoice: null, error: writeRes.error };
    }
    return { ok: true, invoice: newInvoice, warning };
  };

  // 5. مرتجع مبيعات (تحقق صارم على العميل والخادم + تحديث حالة الفاتورة والبنود والديون والمخزون)
  const createSaleReturn = async (data: {
    invoiceId: string;
    invoiceItemId: string;
    productId: string;
    quantity: number;
    refundAmount: number;
    refundMethod: 'cash' | 'wallet' | 'instapay' | 'credit';
    isSellable: boolean;
    reason: string;
  }): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('sales.process_return');
    if (denied) return denied;

    const invoice = salesInvoices.find((inv) => inv.id === data.invoiceId);
    if (!invoice) {
      return { ok: false, error: 'الفاتورة غير موجودة.' };
    }
    if (!can('sales.view_all') && invoice.createdBy && invoice.createdBy !== userId) {
      return { ok: false, error: 'غير مصرح لك بإرجاع فواتير تخص مستخدمين آخرين.' };
    }
    const lineItem = invoice.items.find((it) => it.id === data.invoiceItemId);
    if (!lineItem) {
      return { ok: false, error: 'بند الفاتورة غير موجود.' };
    }

    const validation = validateSaleReturnRequest({
      soldQuantity: lineItem.quantity,
      alreadyReturnedQuantity: lineItem.returnedQuantity || 0,
      requestedQuantity: data.quantity,
    });

    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    if (!supabase) {
      const retId = generateUuid();
      const newReturnedQty = Number(((lineItem.returnedQuantity || 0) + data.quantity).toFixed(2));
      const updatedItems = invoice.items.map((it) =>
        it.id === lineItem.id ? { ...it, returnedQuantity: newReturnedQty } : it
      );
      const nextStatus = determineInvoiceReturnStatus(updatedItems);
      const targetCustomer = invoice.customerId
        ? customers.find((c) => c.id === invoice.customerId)
        : null;
      const finAdj = calculateReturnFinancialAdjustments({
        refundAmount: data.refundAmount,
        refundMethod: data.refundMethod,
        customerCurrentBalance: targetCustomer?.currentBalance || 0,
        invoiceRemainingAmount: invoice.remainingAmount,
      });

      setSalesInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id
            ? {
                ...inv,
                items: updatedItems,
                status: nextStatus,
                remainingAmount: finAdj.newInvoiceRemaining,
              }
            : inv
        )
      );

      const newReturn: SaleReturn = {
        id: retId,
        returnNumber: `RET-${Date.now()}`,
        invoiceId: invoice.id,
        customerId: invoice.customerId || null,
        refundAmount: data.refundAmount,
        refundMethod: data.refundMethod,
        drawerSessionId: activeDrawer?.id || null,
        reason: data.reason,
        createdByName: ownerName,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: generateUuid(),
            invoiceItemId: lineItem.id,
            productId: data.productId,
            productName: lineItem.productName,
            quantity: data.quantity,
            unitRefundPrice:
              data.quantity > 0 ? Number((data.refundAmount / data.quantity).toFixed(2)) : 0,
            unitCost: lineItem.unitCost,
            condition: data.isSellable ? 'sellable' : 'damaged',
          },
        ],
      };
      setSalesReturns((prev) => [newReturn, ...prev]);

      if (data.isSellable) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === data.productId
              ? { ...p, currentStock: Number((p.currentStock + data.quantity).toFixed(2)) }
              : p
          )
        );
      } else {
        setDamagedItems((prev) => [
          {
            id: generateUuid(),
            productId: data.productId,
            productName: lineItem.productName,
            quantity: data.quantity,
            unitCost: lineItem.unitCost,
            totalLoss: Number((data.quantity * lineItem.unitCost).toFixed(2)),
            reason: `مرتجع تالف من فاتورة #${invoice.invoiceNumber}`,
            notes: data.reason,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      if (targetCustomer && finAdj.customerBalanceReduction > 0) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === targetCustomer.id ? { ...c, currentBalance: finAdj.newCustomerBalance } : c
          )
        );
      }

      if (activeDrawer && finAdj.cashDrawerDeduction > 0) {
        setDrawerSessions((prev) =>
          prev.map((d) => {
            if (d.id === activeDrawer.id) {
              const newReturns = d.cashReturns + finAdj.cashDrawerDeduction;
              const expected = calculateDrawerExpectedCash({
                openingCash: d.openingCash,
                cashSales: d.cashSales,
                cashDebtPayments: d.cashDebtPayments,
                cashExpenses: d.cashExpenses,
                cashSupplierPayments: d.cashSupplierPayments,
                cashReturns: newReturns,
                cashWithdrawals: d.cashWithdrawals,
              }).expectedCash;
              return { ...d, cashReturns: newReturns, expectedCash: expected };
            }
            return d;
          })
        );
      }
      pushLocalAudit('RETURN', 'sales_returns', `مرتجع ${lineItem.productName} كمية ${data.quantity}`);
      return { ok: true };
    }

    const activeDrawerId = activeDrawer?.id || null;
    return runSupabaseWrite('تسجيل مرتجع مبيعات', async (sb) => {
      assertSupabaseOk(
        await sb.rpc('process_sale_return', {
          p_invoice_id: data.invoiceId,
          p_invoice_item_id: data.invoiceItemId,
          p_quantity: data.quantity,
          p_refund_amount: data.refundAmount,
          p_refund_method: data.refundMethod,
          p_is_sellable: data.isSellable,
          p_reason: data.reason,
          p_drawer_session_id: activeDrawerId,
        }),
        'تنفيذ المرتجع على الخادم'
      );
    });
  };

  // 6. فاتورة مشتريات وتوريد بضاعة
  const createPurchaseInvoice = async (data: {
    supplierId?: string | null;
    supplierName: string;
    items: Array<{
      productId?: string;
      productName?: string;
      isNew?: boolean;
      quantity: number;
      unitCost: number;
      salePrice?: number;
    }>;
    paymentMethod: 'cash' | 'wallet' | 'instapay' | 'credit' | 'bank';
    paidAmount: number;
    invoicePhotoUrl?: string | null;
    notes?: string;
  }): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('suppliers.manage');
    if (denied) return denied;
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
        const barcode = generateUniqueBarcode([
          ...existingBarcodes,
          ...newlyCreatedProducts.map((p) => p.barcode),
        ]);
        const newProdId = generateUuid();
        const prodName = item.productName?.trim() || 'صنف جديد';
        const chosenSalePrice =
          item.salePrice !== undefined && item.salePrice > 0
            ? Number(item.salePrice.toFixed(2))
            : Number((item.unitCost * 1.25).toFixed(2));

        const newProd: Product = {
          id: newProdId,
          name: prodName,
          barcode,
          category: 'عام',
          costPrice: item.unitCost,
          extraCost: 0,
          salePrice: chosenSalePrice,
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

    const existingStockUpdates = Object.entries(updatedExistingProductsMap).map(([id, delta]) => {
      const prod = products.find((p) => p.id === id);
      return {
        id,
        currentStock: Number(((prod?.currentStock || 0) + delta.quantity).toFixed(2)),
        costPrice: delta.unitCost,
      };
    });

    const supp = data.supplierId ? suppliers.find((s) => s.id === data.supplierId) : null;
    const nextSupplierOwed = supp
      ? Number((supp.owedBalance + (total - paid)).toFixed(2))
      : Number((total - paid).toFixed(2));

    const immediatePayment: SupplierPayment | null =
      data.supplierId && paid > 0
        ? {
            id: generateUuid(),
            supplierId: data.supplierId,
            supplierName: data.supplierName,
            amount: paid,
            paymentMethod: data.paymentMethod === 'credit' ? 'cash' : data.paymentMethod,
            paymentDate: new Date().toISOString().split('T')[0],
            notes: `سداد فوري مع فاتورة توريد رقم #${invoiceNumber}`,
            drawerSessionId: activeDrawer?.id || null,
            createdAt: new Date().toISOString(),
          }
        : null;

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
    }

    if (!supabase) {
      setProducts((prev) => {
        const updated = prev.map((p) => {
          const upd = existingStockUpdates.find((u) => u.id === p.id);
          return upd ? { ...p, currentStock: upd.currentStock, costPrice: upd.costPrice } : p;
        });
        return [...newlyCreatedProducts, ...updated];
      });
      if (data.supplierId) {
        setSuppliers((prev) =>
          prev.map((s) => (s.id === data.supplierId ? { ...s, owedBalance: nextSupplierOwed } : s))
        );
        if (immediatePayment) setSupplierPayments((prev) => [immediatePayment, ...prev]);
      }
      if (activeDrawer && purDrawerUpdate) {
        setDrawerSessions((prev) =>
          prev.map((d) =>
            d.id === activeDrawer.id
              ? {
                  ...d,
                  cashSupplierPayments: purDrawerUpdate!.cash_supplier_payments,
                  expectedCash: purDrawerUpdate!.expected_cash,
                }
              : d
          )
        );
      }
      setPurchaseInvoices((prev) => [newPurchase, ...prev]);
      pushLocalAudit('CREATE', 'purchase_invoices', `فاتورة توريد ${invoiceNumber}`);
      return { ok: true };
    }

    const activeDrawerId = activeDrawer?.id || null;
    return runSupabaseWrite('حفظ فاتورة التوريد', async (sb, sId, uId) => {
      let uploadedPhotoUrl = newPurchase.invoicePhotoUrl || null;
      if (uploadedPhotoUrl && uploadedPhotoUrl.startsWith('data:')) {
        uploadedPhotoUrl = await uploadInvoicePhotoToStorage(sb, sId, purId, uploadedPhotoUrl);
      }

      if (newlyCreatedProducts.length > 0) {
        assertSupabaseOk(
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
          ),
          'إنشاء الأصناف الجديدة بالفاتورة'
        );
      }

      for (const upd of existingStockUpdates) {
        assertSupabaseOk(
          await sb
            .from('products')
            .update({ current_stock: upd.currentStock, cost_price: upd.costPrice })
            .eq('id', upd.id)
            .eq('shop_id', sId),
          'تحديث مخزون الصنف'
        );
      }

      assertSupabaseOk(
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
          created_by_name: currentUserName,
        }),
        'حفظ رأس فاتورة التوريد'
      );

      if (processedItems.length > 0) {
        assertSupabaseOk(
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
          ),
          'حفظ بنود فاتورة التوريد'
        );
      }

      if (data.supplierId) {
        assertSupabaseOk(
          await sb
            .from('suppliers')
            .update({ owed_balance: nextSupplierOwed })
            .eq('id', data.supplierId)
            .eq('shop_id', sId),
          'تحديث مديونية المورد'
        );
      }

      if (immediatePayment) {
        assertSupabaseOk(
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
          }),
          'تسجيل الدفعة الفورية للمورد'
        );
      }

      if (activeDrawerId && purDrawerUpdate) {
        assertSupabaseOk(
          await sb
            .from('drawer_sessions')
            .update(purDrawerUpdate)
            .eq('id', activeDrawerId)
            .eq('shop_id', sId),
          'تحديث الدرج'
        );
      }

      await insertAuditRow(
        sb,
        sId,
        uId,
        'CREATE',
        'purchase_invoices',
        `فاتورة توريد ${invoiceNumber} من ${data.supplierName} بإجمالي ${total} ج.م ومسدد منها ${paid} ج.م`,
        purId
      );
    });
  };

  // إضافة هالك وتوالف
  const addDamagedItem = async (data: {
    productId?: string | null;
    productName?: string;
    quantity: number;
    unitCost?: number;
    reason: string;
    date?: string;
    notes?: string;
  }): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('inventory.manage');
    if (denied) return denied;
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

    if (!supabase) {
      if (data.productId && nextProductStock !== null) {
        setProducts((prev) =>
          prev.map((p) => (p.id === data.productId ? { ...p, currentStock: nextProductStock! } : p))
        );
      }
      setDamagedItems((prev) => [newDamaged, ...prev]);
      pushLocalAudit('DAMAGE', 'damaged_items', `تسجيل هالك: ${finalName}`);
      return { ok: true };
    }

    return runSupabaseWrite('تسجيل الهالك', async (sb, sId, uId) => {
      if (data.productId && nextProductStock !== null) {
        assertSupabaseOk(
          await sb
            .from('products')
            .update({ current_stock: nextProductStock })
            .eq('id', data.productId)
            .eq('shop_id', sId),
          'خصم كمية الهالك من المخزون'
        );
      }
      assertSupabaseOk(
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
          created_by_name: currentUserName,
        }),
        'تسجيل بند الهالك'
      );
      await insertAuditRow(
        sb,
        sId,
        uId,
        'DAMAGE',
        'damaged_items',
        `تسجيل هالك وتوالف: ${finalName} كمية ${qty} بخسارة إجمالية ${totalLoss} ج.م`,
        dmgId
      );
    });
  };

  // 7. المصروفات
  const addExpense = async (data: Omit<Expense, 'id' | 'createdAt'>): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('expenses.create');
    if (denied) return denied;
    const expId = generateUuid();
    const newExpense: Expense = {
      ...data,
      id: expId,
      createdAt: new Date().toISOString(),
      drawerSessionId: activeDrawer?.id || null,
    };

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
    }

    if (!supabase) {
      setExpenses((prev) => [newExpense, ...prev]);
      if (activeDrawer && drawerExpUpdate) {
        setDrawerSessions((prev) =>
          prev.map((d) =>
            d.id === activeDrawer.id
              ? {
                  ...d,
                  cashExpenses: drawerExpUpdate!.cash_expenses,
                  expectedCash: drawerExpUpdate!.expected_cash,
                }
              : d
          )
        );
      }
      pushLocalAudit('CREATE', 'expenses', `صرف مصروف: ${data.category}`);
      successToast(`تم تسجيل المصروف "${data.category}"`);
      return { ok: true };
    }

    const prevExpenses = expenses;
    const prevDrawers = drawerSessions;
    setExpenses((prev) => [newExpense, ...prev]);
    if (activeDrawer && drawerExpUpdate) {
      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === activeDrawer.id
            ? {
                ...d,
                cashExpenses: drawerExpUpdate!.cash_expenses,
                expectedCash: drawerExpUpdate!.expected_cash,
              }
            : d
        )
      );
    }

    const activeDrawerId = activeDrawer?.id || null;
    const res = await runSupabaseWrite('إضافة مصروف', async (sb, sId, uId) => {
      assertSupabaseOk(
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
          created_by_name: currentUserName,
        }),
        'تسجيل المصروف'
      );
      if (activeDrawerId && drawerExpUpdate) {
        assertSupabaseOk(
          await sb
            .from('drawer_sessions')
            .update(drawerExpUpdate)
            .eq('id', activeDrawerId)
            .eq('shop_id', sId),
          'تحديث الدرج'
        );
      }
      await insertAuditRow(
        sb,
        sId,
        uId,
        'CREATE',
        'expenses',
        `صرف مصروف ${data.type === 'fixed' ? 'ثابت' : 'متغير'}: ${data.category} بمبلغ ${data.amount} ج.م`,
        expId
      );
    });
    if (!res.ok) {
      setExpenses(prevExpenses);
      setDrawerSessions(prevDrawers);
    }
    return res;
  };

  // 8. مسحوبات المالك
  const addOwnerWithdrawal = async (
    data: Omit<OwnerWithdrawal, 'id' | 'createdAt' | 'ownerName'>
  ): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('withdrawals.create');
    if (denied) return denied;
    const wthId = generateUuid();
    const newWithdrawal: OwnerWithdrawal = {
      ...data,
      id: wthId,
      ownerName,
      createdAt: new Date().toISOString(),
      drawerSessionId: activeDrawer?.id || null,
    };

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
    }

    if (!supabase) {
      setOwnerWithdrawals((prev) => [newWithdrawal, ...prev]);
      if (activeDrawer && drawerWthUpdate) {
        setDrawerSessions((prev) =>
          prev.map((d) =>
            d.id === activeDrawer.id
              ? {
                  ...d,
                  cashWithdrawals: drawerWthUpdate!.cash_withdrawals,
                  expectedCash: drawerWthUpdate!.expected_cash,
                }
              : d
          )
        );
      }
      pushLocalAudit('WITHDRAWAL', 'owner_withdrawals', `مسحوبات مالك ${data.amount} ج.م`);
      return { ok: true };
    }

    const activeDrawerId = activeDrawer?.id || null;
    return runSupabaseWrite('تسجيل مسحوبات المالك', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb.from('owner_withdrawals').insert({
          id: wthId,
          shop_id: sId,
          amount: data.amount,
          payment_method: data.paymentMethod,
          withdrawal_date: data.date,
          drawer_session_id: activeDrawerId,
          reason: data.reason || null,
          created_by: uId,
          created_by_name: currentUserName,
        }),
        'تسجيل المسحوبات'
      );
      if (activeDrawerId && drawerWthUpdate) {
        assertSupabaseOk(
          await sb
            .from('drawer_sessions')
            .update(drawerWthUpdate)
            .eq('id', activeDrawerId)
            .eq('shop_id', sId),
          'تحديث الدرج'
        );
      }
      await insertAuditRow(
        sb,
        sId,
        uId,
        'WITHDRAWAL',
        'owner_withdrawals',
        `مسحوبات شخصية للمالك (${ownerName}) بمبلغ ${data.amount} ج.م (${data.reason})`,
        wthId
      );
    });
  };

  // 9. الجرد الفعلي للمخزون
  const savePhysicalCountDraft = async (
    items: Array<{ productId: string; countedStock: number }>,
    notes?: string
  ): Promise<ActionResult & { countId?: string }> => {
    const denied = denyIfUnauthorized('inventory.manage');
    if (denied) return denied;
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

    if (!supabase) {
      setPhysicalCounts((prev) => [newCount, ...prev]);
      pushLocalAudit('CREATE', 'physical_counts', `مسودة جرد مخزن #${newCount.countNumber}`);
      return { ok: true, countId };
    }

    const res = await runSupabaseWrite('حفظ مسودة الجرد', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb.from('physical_inventory_counts').insert({
          id: countId,
          shop_id: sId,
          count_date: countDate,
          status: 'draft',
          total_variance_cost: newCount.totalVarianceCost,
          notes: newCount.notes || null,
          created_by: uId,
        }),
        'حفظ رأس الجرد'
      );
      if (processedItems.length > 0) {
        assertSupabaseOk(
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
          ),
          'حفظ بنود الجرد'
        );
      }
      await insertAuditRow(
        sb,
        sId,
        uId,
        'CREATE',
        'physical_counts',
        `مسودة جرد مخزن رقم #${newCount.countNumber}`,
        countId
      );
    });
    return { ...res, countId: res.ok ? countId : undefined };
  };

  const approvePhysicalCount = async (countId: string): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('inventory.manage');
    if (denied) return denied;
    const count = physicalCounts.find((c) => c.id === countId);
    if (!count) return { ok: false, error: 'الجرد غير موجود' };
    const approvedAt = new Date().toISOString();

    if (!supabase) {
      setProducts((prev) =>
        prev.map((p) => {
          const cItem = count.items.find((item) => item.productId === p.id);
          return cItem ? { ...p, currentStock: cItem.countedStock } : p;
        })
      );
      setPhysicalCounts((prev) =>
        prev.map((c) =>
          c.id === countId ? { ...c, status: 'approved', approvedAt, approvedBy: ownerName } : c
        )
      );
      pushLocalAudit('APPROVE', 'physical_counts', `اعتماد الجرد #${count.countNumber}`);
      return { ok: true };
    }

    return runSupabaseWrite('اعتماد الجرد', async (sb, sId, uId) => {
      for (const cItem of count.items) {
        assertSupabaseOk(
          await sb
            .from('products')
            .update({ current_stock: cItem.countedStock })
            .eq('id', cItem.productId)
            .eq('shop_id', sId),
          'تحديث رصيد الصنف بعد الجرد'
        );
      }
      assertSupabaseOk(
        await sb
          .from('physical_inventory_counts')
          .update({ status: 'approved', approved_at: approvedAt, approved_by: uId })
          .eq('id', countId)
          .eq('shop_id', sId),
        'اعتماد جلسة الجرد'
      );
      await insertAuditRow(
        sb,
        sId,
        uId,
        'APPROVE',
        'physical_counts',
        `اعتماد نتيجة الجرد الفعلي رقم #${count.countNumber} وتحديث أرصدة المخزن رسمياً`,
        countId
      );
    });
  };

  // 10. الدرج اليومي
  const openNewDrawerSession = async (openingCash: number): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('drawer.open_close');
    if (denied) return denied;
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

    if (!supabase) {
      setDrawerSessions((prev) => [newSession, ...prev]);
      pushLocalAudit('OPEN', 'drawer_sessions', `فتح وردية درج برصيد ${openingCash} ج.م`);
      successToast('تم فتح وردية الدرج بنجاح');
      return { ok: true };
    }

    const prevDrawers = drawerSessions;
    setDrawerSessions((prev) => [newSession, ...prev]);

    const res = await runSupabaseWrite('فتح وردية الدرج', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb.from('drawer_sessions').insert({
          id: drawerId,
          shop_id: sId,
          status: 'open',
          opened_at: openedAt,
          opening_cash: newSession.openingCash,
          expected_cash: newSession.expectedCash,
          opened_by: uId,
          opened_by_name: currentUserName,
        }),
        'فتح جلسة الدرج'
      );
      await insertAuditRow(
        sb,
        sId,
        uId,
        'OPEN',
        'drawer_sessions',
        `فتح وردية درج جديدة برصيد افتتاحي ${openingCash} ج.م`,
        drawerId
      );
    });
    if (!res.ok) setDrawerSessions(prevDrawers);
    return res;
  };

  const closeDrawerSession = async (
    actualCash: number,
    closingNotes?: string
  ): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('drawer.open_close');
    if (denied) return denied;
    if (!activeDrawer) return { ok: false, error: 'لا توجد وردية درج مفتوحة لإغلاقها' };

    const actual = Number(actualCash.toFixed(2));
    const difference = Number((actual - activeDrawer.expectedCash).toFixed(2));
    const closedAt = new Date().toISOString();
    const targetId = activeDrawer.id;

    if (!supabase) {
      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === targetId
            ? {
                ...d,
                status: 'closed',
                closedAt,
                actualCash: actual,
                difference,
                closingNotes: closingNotes || '',
              }
            : d
        )
      );
      pushLocalAudit('CLOSE', 'drawer_sessions', `إغلاق الدرج بفارق ${difference} ج.م`);
      successToast('تم إغلاق الدرج وحفظ اليومية');
      return { ok: true };
    }

    const prevDrawers = drawerSessions;
    setDrawerSessions((prev) =>
      prev.map((d) =>
        d.id === targetId
          ? {
              ...d,
              status: 'closed',
              closedAt,
              actualCash: actual,
              difference,
              closingNotes: closingNotes || '',
            }
          : d
      )
    );

    const res = await runSupabaseWrite('إغلاق الدرج', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb
          .from('drawer_sessions')
          .update({
            status: 'closed',
            closed_at: closedAt,
            actual_cash: actual,
            difference,
            closing_notes: closingNotes || null,
            closed_by: uId,
            closed_by_name: currentUserName,
          })
          .eq('id', targetId)
          .eq('shop_id', sId),
        'تقفيل وإغلاق الدرج'
      );
      await insertAuditRow(
        sb,
        sId,
        uId,
        'CLOSE',
        'drawer_sessions',
        `إغلاق الدرج: المتوقع ${activeDrawer.expectedCash} ج.م، الفعلي ${actual} ج.م (الفارق: ${difference} ج.م)`,
        targetId
      );
    });
    if (!res.ok) setDrawerSessions(prevDrawers);
    return res;
  };

  const reopenDrawerSession = async (sessionId?: string): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('drawer.reopen');
    if (denied) return denied;
    const timestamp = new Date().toISOString();
    const formattedTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const targetId = sessionId || drawerSessions.find((d) => d.status === 'closed')?.id;
    if (!targetId) {
      return { ok: false, error: 'لا توجد جلسة درج مغلقة لإعادة فتحها' };
    }

    if (!supabase) {
      setDrawerSessions((prev) =>
        prev.map((d) =>
          d.id === targetId
            ? { ...d, status: 'open', reopenedAt: timestamp, reopenedBy: ownerName, closedAt: null }
            : d
        )
      );
      pushLocalAudit('REOPEN', 'drawer_sessions', `إعادة فتح الدرج المغلق بواسطة ${ownerName}`);
      successToast('تم إعادة فتح الدرج بنجاح');
      return { ok: true };
    }

    const prevDrawers = drawerSessions;
    setDrawerSessions((prev) =>
      prev.map((d) =>
        d.id === targetId
          ? { ...d, status: 'open', reopenedAt: timestamp, reopenedBy: ownerName, closedAt: null }
          : d
      )
    );

    const res = await runSupabaseWrite('إعادة فتح الدرج', async (sb, sId, uId) => {
      assertSupabaseOk(
        await sb
          .from('drawer_sessions')
          .update({
            status: 'open',
            reopened_at: timestamp,
            reopened_by: uId,
            reopened_by_name: currentUserName,
            closed_at: null,
          })
          .eq('id', targetId)
          .eq('shop_id', sId),
        'إعادة فتح الدرج'
      );
      await insertAuditRow(
        sb,
        sId,
        uId,
        'REOPEN',
        'drawer_sessions',
        `إعادة فتح الدرج المغلق بواسطة ${ownerName} في ${formattedTime} وتفعيل صلاحية إصدار الفواتير`,
        targetId
      );
    });
    if (!res.ok) setDrawerSessions(prevDrawers);
    return res;
  };

  // 11. استيراد الإكسيل
  const importDataFromExcel = async (type: string, data: any[]): Promise<ActionResult> => {
    const denied = denyIfUnauthorized('import.execute');
    if (denied) return denied;
    if (type === 'products') {
      const normalized = data.map((d) => ({ ...d, id: generateUuid() }));
      if (!supabase) {
        setProducts((prev) => [...normalized, ...prev]);
        pushLocalAudit('IMPORT', 'products', `استيراد ${normalized.length} صنف`);
        return { ok: true };
      }
      return runSupabaseWrite('استيراد المنتجات', async (sb, sId, uId) => {
        if (normalized.length > 0) {
          assertSupabaseOk(
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
            ),
            'استيراد المنتجات'
          );
        }
        await insertAuditRow(sb, sId, uId, 'IMPORT', 'products', `استيراد ${normalized.length} صنف من ملف الإكسيل`);
      });
    } else if (type === 'customers') {
      const normalized = data.map((d) => ({ ...d, id: generateUuid() }));
      if (!supabase) {
        setCustomers((prev) => [...normalized, ...prev]);
        return { ok: true };
      }
      return runSupabaseWrite('استيراد العملاء', async (sb, sId, uId) => {
        if (normalized.length > 0) {
          assertSupabaseOk(
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
            ),
            'استيراد العملاء'
          );
        }
        await insertAuditRow(sb, sId, uId, 'IMPORT', 'customers', `استيراد ${normalized.length} عميل`);
      });
    } else if (type === 'suppliers') {
      const normalized = data.map((d) => ({ ...d, id: generateUuid() }));
      if (!supabase) {
        setSuppliers((prev) => [...normalized, ...prev]);
        return { ok: true };
      }
      return runSupabaseWrite('استيراد الموردين', async (sb, sId, uId) => {
        if (normalized.length > 0) {
          assertSupabaseOk(
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
            ),
            'استيراد الموردين'
          );
        }
        await insertAuditRow(sb, sId, uId, 'IMPORT', 'suppliers', `استيراد ${normalized.length} مورد`);
      });
    } else if (type === 'opening_stock') {
      const updatedExisting: Product[] = [];
      const insertedNew: Product[] = [];
      const working = [...products];
      for (const item of data) {
        const matchIndex = working.findIndex(
          (p) =>
            (item.barcode && p.barcode && p.barcode === item.barcode) ||
            p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
        if (matchIndex >= 0) {
          const nextProd = {
            ...working[matchIndex],
            openingStock: item.openingStock,
            currentStock: item.openingStock,
            costPrice: item.costPrice > 0 ? item.costPrice : working[matchIndex].costPrice,
          };
          working[matchIndex] = nextProd;
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
          working.unshift(newProd);
          insertedNew.push(newProd);
        }
      }
      if (!supabase) {
        setProducts(working);
        return { ok: true };
      }
      return runSupabaseWrite('استيراد المخزون الافتتاحي', async (sb, sId, uId) => {
        for (const p of updatedExisting) {
          assertSupabaseOk(
            await sb
              .from('products')
              .update({
                opening_stock: p.openingStock,
                current_stock: p.currentStock,
                cost_price: p.costPrice,
              })
              .eq('id', p.id)
              .eq('shop_id', sId),
            'تحديث رصيد افتتاحي'
          );
        }
        if (insertedNew.length > 0) {
          assertSupabaseOk(
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
            ),
            'إدراج أصناف المخزون الافتتاحي'
          );
        }
        await insertAuditRow(sb, sId, uId, 'IMPORT', 'products', `تحديث أرصدة افتتاحية لـ ${data.length} صنف`);
      });
    } else if (type === 'expenses') {
      const normalized = data.map((d) => ({ ...d, id: generateUuid() }));
      if (!supabase) {
        setExpenses((prev) => [...normalized, ...prev]);
        return { ok: true };
      }
      return runSupabaseWrite('استيراد المصروفات', async (sb, sId, uId) => {
        if (normalized.length > 0) {
          assertSupabaseOk(
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
            ),
            'استيراد المصروفات'
          );
        }
        await insertAuditRow(sb, sId, uId, 'IMPORT', 'expenses', `استيراد ${normalized.length} مصروف`);
      });
    }

    return { ok: true };
  };

  // 12. النسخ الاحتياطي
  const exportDatabaseJSON = () => {
    const canSeeCostProfit = can('finance.view_cost_profit');
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      shopName,
      ownerName,
      products: sanitizeExportDataByPermission(products, canSeeCostProfit),
      customers,
      suppliers,
      supplierPayments,
      damagedItems: canSeeCostProfit ? damagedItems : [],
      salesInvoices: sanitizeExportDataByPermission(salesInvoices, canSeeCostProfit),
      salesReturns,
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
      if (parsed.salesReturns) setSalesReturns(parsed.salesReturns);
      if (parsed.purchaseInvoices) setPurchaseInvoices(parsed.purchaseInvoices);
      if (parsed.expenses) setExpenses(parsed.expenses);
      if (parsed.ownerWithdrawals) setOwnerWithdrawals(parsed.ownerWithdrawals);
      if (parsed.physicalCounts) setPhysicalCounts(parsed.physicalCounts);
      if (parsed.drawerSessions) setDrawerSessions(parsed.drawerSessions);
      if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
      pushLocalAudit('RESTORE', 'system', 'استعادة نسخة احتياطية كاملة لقاعدة البيانات');
      return true;
    } catch (e) {
      console.error('Failed to restore backup:', e);
      return false;
    }
  };

  const resetToSampleData = () => {
    if (supabase) return;
    setProducts(defaultProducts);
    setCustomers(defaultCustomers);
    setSuppliers(defaultSuppliers);
    setSupplierPayments(defaultSupplierPayments);
    setDamagedItems(defaultDamagedItems);
    setSalesInvoices([]);
    setSalesReturns([]);
    setPurchaseInvoices([]);
    setExpenses([]);
    setOwnerWithdrawals([]);
    setPhysicalCounts([]);
    setDrawerSessions([defaultDrawer]);
    pushLocalAudit('RESET', 'system', 'إعادة تعيين البيانات للوضع الافتراضي');
  };

  return (
    <ShopContext.Provider
      value={{
        shopId,
        userId,
        shopName,
        ownerName,
        currentUserName,
        userEmail,
        userRole,
        permissions,
        can,
        sessionTimeoutMinutes,
        updateSessionTimeout,
        updateShopName,
        completeFastLogin,
        isSupabaseConfigured,
        cloudStatus,
        cloudError,
        syncError,
        clearSyncError,
        isSaving,
        isInitialLoading: !isLoaded || isAuthChecking,
        isAuthChecking,
        isAuthenticated,
        refreshFromCloud,
        signOut,
        products: products.filter((p) => !p.deletedAt),
        customers: customers.filter((c) => !c.deletedAt),
        suppliers: suppliers.filter((s) => !s.deletedAt),
        supplierPayments,
        damagedItems,
        salesInvoices: salesInvoices.filter((s) => !s.deletedAt),
        salesReturns,
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
