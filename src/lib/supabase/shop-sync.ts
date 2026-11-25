import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Product,
  Customer,
  Supplier,
  SupplierPayment,
  DamagedItem,
  SaleInvoice,
  SaleReturn,
  PurchaseInvoice,
  Expense,
  OwnerWithdrawal,
  PhysicalCount,
  DrawerSession,
  AuditLog,
} from '@/lib/store/shop-store';

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function assertSupabaseOk<T extends { error: any }>(res: T, actionLabel: string): T {
  if (res.error) {
    const code = res.error.code ? ` [${res.error.code}]` : '';
    const msg = res.error.message || 'خطأ غير معروف في قاعدة البيانات';
    throw new Error(`${actionLabel}${code}: ${msg}`);
  }
  return res;
}

export async function uploadInvoicePhotoToStorage(
  supabase: SupabaseClient,
  shopId: string,
  invoiceId: string,
  dataUrl: string
): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl || null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const path = `${shopId}/${invoiceId}.${ext}`;
    const { error } = await supabase.storage
      .from('invoice-attachments')
      .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
    if (error) {
      console.warn('Storage upload fallback:', error.message);
      return dataUrl;
    }
    const { data } = supabase.storage.from('invoice-attachments').getPublicUrl(path);
    return data?.publicUrl || dataUrl;
  } catch (e) {
    console.warn('Storage upload exception:', e);
    return dataUrl;
  }
}

export interface LoadedShopPayload {
  shopId: string;
  shopName: string;
  ownerName: string;
  userRole: string;
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
  auditLogs: AuditLog[];
}

export interface LoadShopResult {
  payload: LoadedShopPayload | null;
  error?: string;
}

export async function loadShopDataFromSupabase(
  supabase: SupabaseClient,
  userId: string
): Promise<LoadShopResult> {
  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('id, shop_id, full_name, role, shops(name, owner_name)')
    .eq('id', userId)
    .maybeSingle();

  if (profError) {
    const code = profError.code ? ` (${profError.code})` : '';
    return {
      payload: null,
      error: `تعذر قراءة ملف المستخدم وصلاحية المتجر${code}: ${profError.message}`,
    };
  }

  if (!profile?.shop_id) {
    return {
      payload: null,
      error: 'هذا الحساب غير مربوط بمتجر (لا يوجد سجل في جدول profiles). يرجى تشغيل ملف الميجريشن وتخصيص shop_id للحساب.',
    };
  }

  const shopId = profile.shop_id as string;
  const shopRow = Array.isArray(profile.shops) ? profile.shops[0] : profile.shops;
  const shopName = (shopRow as { name?: string } | null)?.name || 'محل شفرة';
  const ownerName =
    profile.full_name ||
    (shopRow as { owner_name?: string } | null)?.owner_name ||
    'كريم';
  const userRole = (profile.role as string) || 'owner';

  const [
    productsRes,
    customersRes,
    suppliersRes,
    supPayRes,
    damagedRes,
    salesRes,
    returnsRes,
    purchasesRes,
    expensesRes,
    withdrawalsRes,
    countsRes,
    drawersRes,
    logsRes,
  ] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('suppliers')
      .select('*')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('supplier_payments')
      .select('*')
      .eq('shop_id', shopId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('damaged_items')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false }),
    supabase
      .from('sales_invoices')
      .select('*, sales_invoice_items(*)')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('sales_returns')
      .select('*, sales_return_items(*)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false }),
    supabase
      .from('purchase_invoices')
      .select('*, purchase_invoice_items(*)')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('expenses')
      .select('*')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false }),
    supabase
      .from('owner_withdrawals')
      .select('*')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .order('withdrawal_date', { ascending: false }),
    supabase
      .from('physical_inventory_counts')
      .select('*, physical_inventory_items(*)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false }),
    supabase
      .from('drawer_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .order('opened_at', { ascending: false }),
    supabase
      .from('audit_logs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const tableErrors = [
    { name: 'products', err: productsRes.error },
    { name: 'customers', err: customersRes.error },
    { name: 'suppliers', err: suppliersRes.error },
    { name: 'supplier_payments', err: supPayRes.error },
    { name: 'damaged_items', err: damagedRes.error },
    { name: 'sales_invoices', err: salesRes.error },
    { name: 'sales_returns', err: returnsRes.error },
    { name: 'purchase_invoices', err: purchasesRes.error },
    { name: 'expenses', err: expensesRes.error },
    { name: 'owner_withdrawals', err: withdrawalsRes.error },
    { name: 'physical_inventory_counts', err: countsRes.error },
    { name: 'drawer_sessions', err: drawersRes.error },
    { name: 'audit_logs', err: logsRes.error },
  ].filter((t) => t.err);

  if (tableErrors.length > 0) {
    const first = tableErrors[0];
    const code = first.err?.code ? ` (${first.err.code})` : '';
    return {
      payload: null,
      error: `فشل قراءة جدول ${first.name}${code}: ${first.err?.message || 'صلاحيات قاعدة البيانات مرفوضة'}. يرجى تشغيل ملف الميجريشن 5 لمنح الصلاحيات (GRANT / RLS).`,
    };
  }

  const suppliers: Supplier[] = (suppliersRes.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    company: s.company || '',
    phone: s.phone || '',
    owedBalance: Number(s.owed_balance || 0),
    notes: s.notes || '',
    createdAt: s.created_at,
    deletedAt: s.deleted_at,
  }));

  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

  const products: Product[] = (productsRes.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode || '',
    category: p.category_name || 'عام',
    costPrice: Number(p.cost_price || 0),
    extraCost: Number(p.extra_cost || 0),
    salePrice: Number(p.sale_price || 0),
    openingStock: Number(p.opening_stock || 0),
    currentStock: Number(p.current_stock || 0),
    minStockAlert: Number(p.min_stock_alert || 5),
    unit: p.unit || 'قطعة',
    createdAt: p.created_at,
    deletedAt: p.deleted_at,
  }));

  const customers: Customer[] = (customersRes.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    phone: c.phone || '',
    creditLimit: Number(c.credit_limit || 0),
    currentBalance: Number(c.current_balance || 0),
    notes: c.notes || '',
    createdAt: c.created_at,
    deletedAt: c.deleted_at,
  }));

  const supplierPayments: SupplierPayment[] = (supPayRes.data || []).map((sp: any) => ({
    id: sp.id,
    supplierId: sp.supplier_id,
    supplierName: supplierMap.get(sp.supplier_id) || 'مورد',
    amount: Number(sp.amount || 0),
    paymentMethod: sp.payment_method || 'cash',
    paymentDate: sp.payment_date || String(sp.created_at).slice(0, 10),
    notes: sp.notes || '',
    drawerSessionId: sp.drawer_session_id,
    createdAt: sp.created_at,
  }));

  const damagedItems: DamagedItem[] = (damagedRes.data || []).map((d: any) => ({
    id: d.id,
    productId: d.product_id,
    productName: d.product_name,
    quantity: Number(d.quantity || 0),
    unitCost: Number(d.unit_cost || 0),
    totalLoss: Number(d.total_loss || 0),
    reason: d.reason,
    notes: d.notes || '',
    date: d.damage_date || String(d.created_at).slice(0, 10),
    createdAt: d.created_at,
  }));

  const salesInvoices: SaleInvoice[] = (salesRes.data || []).map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    customerId: inv.customer_id,
    customerName: inv.customer_name || 'عميل نقدي',
    items: (inv.sales_invoice_items || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      barcode: item.barcode || '',
      quantity: Number(item.quantity || 0),
      returnedQuantity: Number(item.returned_quantity || 0),
      unitCost: Number(item.unit_cost || 0),
      unitPrice: Number(item.unit_price || 0),
      discount: Number(item.discount || 0),
      lineTotal: Number(item.line_total || 0),
      lineCost: Number(item.line_cost || 0),
      lineProfit: Number(item.line_profit || 0),
    })),
    subtotal: Number(inv.subtotal || 0),
    discount: Number(inv.discount || 0),
    totalAmount: Number(inv.total_amount || 0),
    totalCost: Number(inv.total_cost || 0),
    grossProfit: Number(inv.gross_profit || 0),
    paidAmount: Number(inv.paid_amount || 0),
    remainingAmount: Number(inv.remaining_amount || 0),
    paymentMethod: inv.payment_method,
    drawerSessionId: inv.drawer_session_id,
    notes: inv.notes || '',
    status: inv.status || 'completed',
    createdAt: inv.created_at,
    deletedAt: inv.deleted_at,
  }));

  const salesReturns: SaleReturn[] = (returnsRes.data || []).map((ret: any) => ({
    id: ret.id,
    returnNumber: ret.return_number,
    invoiceId: ret.invoice_id || null,
    customerId: ret.customer_id || null,
    refundAmount: Number(ret.refund_amount || 0),
    refundMethod: ret.refund_method === 'credit_balance' ? 'credit' : ret.refund_method,
    drawerSessionId: ret.drawer_session_id || null,
    reason: ret.reason || '',
    createdBy: ret.created_by || null,
    createdByName: ret.created_by_name || ownerName,
    createdAt: ret.created_at,
    items: (ret.sales_return_items || []).map((ri: any) => ({
      id: ri.id,
      invoiceItemId: ri.invoice_item_id || null,
      productId: ri.product_id,
      productName: ri.product_name,
      quantity: Number(ri.quantity || 0),
      unitRefundPrice: Number(ri.unit_refund_price || 0),
      unitCost: Number(ri.unit_cost || 0),
      condition: ri.condition || 'sellable',
    })),
  }));

  const purchaseInvoices: PurchaseInvoice[] = (purchasesRes.data || []).map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    supplierId: inv.supplier_id,
    supplierName: inv.supplier_name || 'مورد',
    items: (inv.purchase_invoice_items || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: Number(item.quantity || 0),
      unitCost: Number(item.unit_cost || 0),
      lineTotal: Number(item.line_total || 0),
    })),
    totalAmount: Number(inv.total_amount || 0),
    paidAmount: Number(inv.paid_amount || 0),
    remainingAmount: Number(inv.remaining_amount || 0),
    paymentMethod: inv.payment_method,
    drawerSessionId: inv.drawer_session_id,
    notes: inv.notes || '',
    invoicePhotoUrl: inv.invoice_photo_url || null,
    createdAt: inv.created_at,
    deletedAt: inv.deleted_at,
  }));

  const expenses: Expense[] = (expensesRes.data || []).map((e: any) => ({
    id: e.id,
    type: e.type,
    category: e.category,
    amount: Number(e.amount || 0),
    paymentMethod: e.payment_method,
    date: e.expense_date,
    notes: e.notes || '',
    drawerSessionId: e.drawer_session_id,
    createdAt: e.created_at,
    deletedAt: e.deleted_at,
  }));

  const ownerWithdrawals: OwnerWithdrawal[] = (withdrawalsRes.data || []).map((w: any) => ({
    id: w.id,
    ownerName,
    amount: Number(w.amount || 0),
    paymentMethod: w.payment_method,
    date: w.withdrawal_date,
    reason: w.reason || '',
    drawerSessionId: w.drawer_session_id,
    createdAt: w.created_at,
    deletedAt: w.deleted_at,
  }));

  const physicalCounts: PhysicalCount[] = (countsRes.data || []).map((c: any) => ({
    id: c.id,
    countNumber: Number(c.count_number || 1),
    countDate: c.count_date,
    status: c.status,
    items: (c.physical_inventory_items || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      systemStock: Number(item.system_stock || 0),
      countedStock: Number(item.counted_stock || 0),
      variance: Number(item.variance || 0),
      unitCost: Number(item.unit_cost || 0),
      varianceCost: Number(item.variance_cost || 0),
    })),
    totalVarianceCost: Number(c.total_variance_cost || 0),
    notes: c.notes || '',
    approvedAt: c.approved_at,
    approvedBy: c.approved_by,
    createdAt: c.created_at,
  }));

  const drawerSessions: DrawerSession[] = (drawersRes.data || []).map((d: any) => ({
    id: d.id,
    sessionNumber: Number(d.session_number || 1),
    openedAt: d.opened_at,
    closedAt: d.closed_at,
    status: d.status,
    openingCash: Number(d.opening_cash || 0),
    cashSales: Number(d.cash_sales || 0),
    cashReturns: Number(d.cash_returns || 0),
    cashDebtPayments: Number(d.cash_customer_debt_payments || 0),
    cashSupplierPayments: Number(d.cash_supplier_payments || 0),
    cashExpenses: Number(d.cash_expenses || 0),
    cashWithdrawals: Number(d.cash_withdrawals || 0),
    expectedCash: Number(d.expected_cash || 0),
    actualCash: d.actual_cash !== null && d.actual_cash !== undefined ? Number(d.actual_cash) : null,
    difference: d.difference !== null && d.difference !== undefined ? Number(d.difference) : null,
    walletTotal: Number(d.wallet_total || 0),
    instapayTotal: Number(d.instapay_total || 0),
    closingNotes: d.closing_notes || '',
    reopenedAt: d.reopened_at,
    reopenedBy: d.reopened_by,
  }));

  const auditLogs: AuditLog[] = (logsRes.data || []).map((l: any) => ({
    id: l.id,
    action: l.action,
    tableName: l.table_name,
    details: (l.new_data && l.new_data.details) || `${l.action} on ${l.table_name}`,
    createdAt: l.created_at,
  }));

  return {
    payload: {
      shopId,
      shopName,
      ownerName,
      userRole,
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
    },
  };
}
