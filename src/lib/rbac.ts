/**
 * محرك الصلاحيات والأدوار الموحد (RBAC) - نظام محل شفرة
 * يغطي:
 * - الأدوار: admin (مدير/المالك)، cashier (كاشير)، accountant (محاسب)
 * - مصفوفة الصلاحيات الافتراضية لكل دور
 * - التجاوزات الفردية لكل مستخدم (allow / deny / inherit)
 * - حماية المسارات وإخفاء البيانات المالية الحساسة (التكلفة، الربح، الهامش)
 */

export type RoleKey = 'admin' | 'cashier' | 'accountant';

export type PermissionKey =
  | 'dashboard.view'
  | 'pos.view'
  | 'pos.create'
  | 'pos.apply_discount'
  | 'sales.view'
  | 'sales.view_all'
  | 'sales.process_return'
  | 'products.view'
  | 'products.create'
  | 'products.edit'
  | 'products.delete'
  | 'customers.view'
  | 'customers.create'
  | 'customers.edit'
  | 'customers.collect_payment'
  | 'suppliers.view'
  | 'suppliers.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'expenses.view'
  | 'expenses.create'
  | 'drawer.view'
  | 'drawer.open_close'
  | 'drawer.reopen'
  | 'reports.view'
  | 'withdrawals.view'
  | 'withdrawals.create'
  | 'import.view'
  | 'import.execute'
  | 'export.data'
  | 'settings.view'
  | 'settings.manage'
  | 'finance.view_cost_profit'
  | 'users.manage'
  | 'audit.view';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  group: string;
  description: string;
}

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'مدير النظام (المالك)',
  cashier: 'كاشير',
  accountant: 'محاسب',
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // لوحة التحكم والمالية الحساسة
  { key: 'dashboard.view', label: 'عرض الرئيسية والمؤشرات', group: 'عام ومالية', description: 'الوصول إلى الصفحة الرئيسية وملخص اليوم' },
  { key: 'finance.view_cost_profit', label: 'الاطلاع على التكلفة والأرباح والهامش', group: 'عام ومالية', description: 'إظهار أسعار التكلفة ومجمل وصافي الربح وهامش الربح في الشاشات والـ API والتصدير' },
  { key: 'export.data', label: 'تصدير التقارير والنسخ الاحتياطي', group: 'عام ومالية', description: 'تصدير ملفات Excel/PDF وتنزيل نسخة JSON' },

  // نقطة البيع والفواتير
  { key: 'pos.view', label: 'عرض نقطة البيع (POS)', group: 'المبيعات والفواتير', description: 'الدخول لشاشة البيع الجديدة' },
  { key: 'pos.create', label: 'إنشاء فاتورة بيع', group: 'المبيعات والفواتير', description: 'إصدار فواتير بيع جديدة للعملاء' },
  { key: 'pos.apply_discount', label: 'تطبيق خصم على الفاتورة', group: 'المبيعات والفواتير', description: 'السماح بإعطاء خصومات عند البيع' },
  { key: 'sales.view', label: 'عرض سجل الفواتير والمرتجع', group: 'المبيعات والفواتير', description: 'عرض فواتير المبيعات (فواتيره فقط افتراضياً)' },
  { key: 'sales.view_all', label: 'عرض فواتير جميع المستخدمين', group: 'المبيعات والفواتير', description: 'الاطلاع على فواتير كافة البائعين بالمحل' },
  { key: 'sales.process_return', label: 'تنفيذ المرتجعات', group: 'المبيعات والفواتير', description: 'إرجاع أصناف من الفواتير السليمة أو التالفة' },

  // المنتجات
  { key: 'products.view', label: 'عرض صفحة المنتجات', group: 'المنتجات والباركود', description: 'الدخول لصفحة المنتجات والبحث وطباعة الاستيكر' },
  { key: 'products.create', label: 'إضافة منتج جديد', group: 'المنتجات والباركود', description: 'إنشاء أصناف جديدة وتوليد باركود' },
  { key: 'products.edit', label: 'تعديل المنتجات والأسعار', group: 'المنتجات والباركود', description: 'تعديل بيانات أو أسعار المنتجات وطباعة الملصقات' },
  { key: 'products.delete', label: 'حذف المنتجات', group: 'المنتجات والباركود', description: 'حذف أصناف من الكتالوج' },

  // العملاء
  { key: 'customers.view', label: 'عرض العملاء وكشف الحساب', group: 'العملاء والديون', description: 'عرض قائمة العملاء وأرصدتهم وفواتيرهم' },
  { key: 'customers.create', label: 'إضافة عميل جديد', group: 'العملاء والديون', description: 'إضافة عملاء من صفحة العملاء أو نقطة البيع' },
  { key: 'customers.edit', label: 'تعديل بيانات العميل', group: 'العملاء والديون', description: 'تعديل سقف الائتمان وبيانات العملاء' },
  { key: 'customers.collect_payment', label: 'تحصيل سداد ديون العملاء', group: 'العملاء والديون', description: 'استلام دفعات سداد من العملاء' },

  // الموردين والمشتريات
  { key: 'suppliers.view', label: 'عرض الموردين وفواتير الشراء', group: 'الموردين والمشتريات', description: 'عرض الموردين وكشف حساب الأستاذ وفواتير التوريد' },
  { key: 'suppliers.manage', label: 'إدارة الموردين والتوريد والسداد', group: 'الموردين والمشتريات', description: 'إضافة مورد وتسجيل فواتير شراء وصرف دفعات' },

  // المخزون والهالك
  { key: 'inventory.view', label: 'عرض المخزون والجرد والهالك', group: 'المخزون والجرد', description: 'استعراض الأرصدة وجلسات الجرد وسجل الهالك' },
  { key: 'inventory.manage', label: 'تنفيذ الجرد وتسجيل الهالك', group: 'المخزون والجرد', description: 'بدء واعتماد الجرد الفعلي وتسجيل التوالف' },

  // المصروفات والدرج والتقارير والمسحوبات
  { key: 'expenses.view', label: 'عرض المصروفات', group: 'المصروفات والدرج', description: 'مشاهدة المصروفات الثابتة والمتغيرة' },
  { key: 'expenses.create', label: 'تسجيل مصروف جديد', group: 'المصروفات والدرج', description: 'صرف مصروفات من الدرج أو المحفظة' },
  { key: 'drawer.view', label: 'عرض الدرج وتاريخ التقفيل', group: 'المصروفات والدرج', description: 'مشاهدة جلسات الدرج وتاريخ الإغلاق' },
  { key: 'drawer.open_close', label: 'فتح وتقفيل الدرج اليومي', group: 'المصروفات والدرج', description: 'بدء وردية جديدة وإغلاق اليومية' },
  { key: 'drawer.reopen', label: 'إعادة فتح درج مغلق', group: 'المصروفات والدرج', description: 'صلاحية حساسة لإعادة فتح يومية مقفولة' },

  // التقارير والمسحوبات والإعدادات والإدارة
  { key: 'reports.view', label: 'عرض التقارير والأرباح', group: 'التقارير والإدارة', description: 'الوصول لصفحة التقارير المالية التفصيلية' },
  { key: 'withdrawals.view', label: 'عرض مسحوبات المالك', group: 'التقارير والإدارة', description: 'الاطلاع على سجل مسحوبات المالك' },
  { key: 'withdrawals.create', label: 'تسجيل سحب شخصي للمالك', group: 'التقارير والإدارة', description: 'تسجيل سحب مالي من الدرج للمالك' },
  { key: 'import.view', label: 'عرض صفحة استيراد الإكسيل', group: 'التقارير والإدارة', description: 'الوصول لصفحة الدمغات واستيراد الشيتات' },
  { key: 'import.execute', label: 'تنفيذ استيراد ملفات الإكسيل', group: 'التقارير والإدارة', description: 'رفع وحفظ بيانات الإكسيل في القاعدة' },
  { key: 'settings.view', label: 'عرض الإعدادات والنسخ', group: 'التقارير والإدارة', description: 'الدخول لصفحة إعدادات المحل' },
  { key: 'settings.manage', label: 'تعديل الإعدادات واستعادة النسخ', group: 'التقارير والإدارة', description: 'تغيير مهلة الجلسة واستعادة النسخ الاحتياطي' },
  { key: 'users.manage', label: 'إدارة المستخدمين والصلاحيات', group: 'التقارير والإدارة', description: 'إنشاء وتعديل وحذف المستخدمين وضبط مصفوفة الصلاحيات' },
  { key: 'audit.view', label: 'عرض سجل التدقيق والمراقبة', group: 'التقارير والإدارة', description: 'تتبع كل عملية حسب المستخدم والتاريخ' },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_DEFINITIONS.map((p) => p.key);

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  admin: [...ALL_PERMISSIONS],
  cashier: [
    'pos.view',
    'pos.create',
    'sales.view',
    'sales.process_return',
    'customers.view',
    'customers.create',
  ],
  accountant: [
    'expenses.view',
    'expenses.create',
    'suppliers.view',
    'suppliers.manage',
    'reports.view',
    'inventory.view',
    'drawer.view',
    'finance.view_cost_profit',
    'export.data',
  ],
};

export function normalizeRoleKey(role?: string | null): RoleKey {
  if (!role || role === 'owner' || role === 'admin') return 'admin';
  if (role === 'cashier') return 'cashier';
  if (role === 'accountant') return 'accountant';
  return 'cashier';
}

export type PermissionOverrideValue = boolean; // true = سماح إضافي، false = منع

export function resolveEffectivePermissions(input: {
  role?: string | null;
  rolePermissions?: Partial<Record<PermissionKey, boolean>> | PermissionKey[];
  userOverrides?: Partial<Record<PermissionKey, boolean>>;
}): Record<PermissionKey, boolean> {
  const role = normalizeRoleKey(input.role);
  const result = {} as Record<PermissionKey, boolean>;

  if (role === 'admin') {
    for (const key of ALL_PERMISSIONS) {
      result[key] = true;
    }
    return result;
  }

  let baseSet: Partial<Record<PermissionKey, boolean>> = {};
  if (Array.isArray(input.rolePermissions)) {
    for (const k of input.rolePermissions) {
      baseSet[k] = true;
    }
  } else if (input.rolePermissions && Object.keys(input.rolePermissions).length > 0) {
    baseSet = input.rolePermissions;
  } else {
    for (const k of DEFAULT_ROLE_PERMISSIONS[role]) {
      baseSet[k] = true;
    }
  }

  for (const key of ALL_PERMISSIONS) {
    if (input.userOverrides && typeof input.userOverrides[key] === 'boolean') {
      result[key] = Boolean(input.userOverrides[key]);
    } else {
      result[key] = Boolean(baseSet[key]);
    }
  }

  return result;
}

export function hasPermission(
  permissions: Partial<Record<PermissionKey, boolean>> | undefined | null,
  key: PermissionKey
): boolean {
  return Boolean(permissions && permissions[key]);
}

export const ROUTE_PERMISSION_MAP: Array<{ prefix: string; exact?: boolean; permission: PermissionKey }> = [
  { prefix: '/', exact: true, permission: 'dashboard.view' },
  { prefix: '/sales/new', exact: true, permission: 'pos.view' },
  { prefix: '/sales', exact: true, permission: 'sales.view' },
  { prefix: '/products', permission: 'products.view' },
  { prefix: '/customers', permission: 'customers.view' },
  { prefix: '/suppliers', permission: 'suppliers.view' },
  { prefix: '/inventory/damaged', permission: 'inventory.view' },
  { prefix: '/inventory', permission: 'inventory.view' },
  { prefix: '/expenses', permission: 'expenses.view' },
  { prefix: '/drawer', permission: 'drawer.view' },
  { prefix: '/reports', permission: 'reports.view' },
  { prefix: '/withdrawals', permission: 'withdrawals.view' },
  { prefix: '/import', permission: 'import.view' },
  { prefix: '/settings', permission: 'settings.view' },
  { prefix: '/users', permission: 'users.manage' },
  { prefix: '/audit-log', permission: 'audit.view' },
];

export const PUBLIC_ROUTES = ['/login', '/no-permission', '/auth/callback'];

export function getRequiredPermissionForRoute(pathname: string): PermissionKey | null {
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return null;
  }
  const exactMatch = ROUTE_PERMISSION_MAP.find((r) => r.exact && pathname === r.prefix);
  if (exactMatch) return exactMatch.permission;
  const prefixMatch = ROUTE_PERMISSION_MAP.find((r) => !r.exact && (pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)));
  return prefixMatch ? prefixMatch.permission : null;
}

export function canAccessRoute(
  pathname: string,
  permissions: Partial<Record<PermissionKey, boolean>> | undefined | null
): boolean {
  const required = getRequiredPermissionForRoute(pathname);
  if (!required) return true;
  return hasPermission(permissions, required);
}

export function getDefaultHomeRoute(
  permissions: Partial<Record<PermissionKey, boolean>> | undefined | null
): string {
  const order: Array<{ href: string; permission: PermissionKey }> = [
    { href: '/', permission: 'dashboard.view' },
    { href: '/sales/new', permission: 'pos.view' },
    { href: '/reports', permission: 'reports.view' },
    { href: '/expenses', permission: 'expenses.view' },
    { href: '/sales', permission: 'sales.view' },
    { href: '/customers', permission: 'customers.view' },
    { href: '/suppliers', permission: 'suppliers.view' },
    { href: '/inventory', permission: 'inventory.view' },
    { href: '/drawer', permission: 'drawer.view' },
    { href: '/products', permission: 'products.view' },
  ];
  const found = order.find((item) => hasPermission(permissions, item.permission));
  return found ? found.href : '/no-permission';
}

export function canManageAdminChange(input: {
  activeAdminCount: number;
  targetIsActiveAdmin: boolean;
  action: 'delete' | 'deactivate' | 'demote';
}): { allowed: boolean; reason?: string } {
  if (input.targetIsActiveAdmin && input.activeAdminCount <= 1) {
    return {
      allowed: false,
      reason: 'يجب وجود مدير (Admin) نشط واحد على الأقل في النظام دائماً. لا يمكن حذف أو إيقاف أو تخفيض صلاحية آخر مدير.',
    };
  }
  return { allowed: true };
}

/**
 * إخفاء حقول التكلفة والربح والهامش عن المستخدمين الذين لا يملكون صلاحية finance.view_cost_profit
 * (يُستخدم في استجابات الـ API وملفات التصدير)
 */
export function redactCostAndProfitFromProduct<T extends Record<string, any>>(
  product: T,
  canViewCostProfit: boolean
): T {
  if (canViewCostProfit) return product;
  const copy: Record<string, any> = { ...product };
  if ('costPrice' in copy) copy.costPrice = 0;
  if ('extraCost' in copy) copy.extraCost = 0;
  if ('cost_price' in copy) copy.cost_price = 0;
  if ('extra_cost' in copy) copy.extra_cost = 0;
  if ('margin' in copy) copy.margin = null;
  return copy as T;
}

export function redactCostAndProfitFromInvoice<T extends Record<string, any>>(
  invoice: T,
  canViewCostProfit: boolean
): T {
  if (canViewCostProfit) return invoice;
  const copy: Record<string, any> = { ...invoice };
  if ('totalCost' in copy) copy.totalCost = 0;
  if ('grossProfit' in copy) copy.grossProfit = 0;
  if ('total_cost' in copy) copy.total_cost = 0;
  if ('gross_profit' in copy) copy.gross_profit = 0;
  if (Array.isArray(copy.items)) {
    copy.items = copy.items.map((item: Record<string, any>) => ({
      ...item,
      ...(typeof item.unitCost !== 'undefined' ? { unitCost: 0 } : {}),
      ...(typeof item.lineCost !== 'undefined' ? { lineCost: 0 } : {}),
      ...(typeof item.lineProfit !== 'undefined' ? { lineProfit: 0 } : {}),
      ...(typeof item.unit_cost !== 'undefined' ? { unit_cost: 0 } : {}),
      ...(typeof item.line_cost !== 'undefined' ? { line_cost: 0 } : {}),
      ...(typeof item.line_profit !== 'undefined' ? { line_profit: 0 } : {}),
    }));
  }
  return copy as T;
}

export function sanitizeExportDataByPermission<T extends Record<string, any>>(
  rows: T[],
  canViewCostProfit: boolean
): Partial<T>[] {
  if (canViewCostProfit) return rows;
  const forbiddenKeys = new Set([
    'costPrice',
    'extraCost',
    'cost_price',
    'extra_cost',
    'totalCost',
    'total_cost',
    'grossProfit',
    'gross_profit',
    'lineCost',
    'line_cost',
    'lineProfit',
    'line_profit',
    'unitCost',
    'unit_cost',
    'margin',
    'التكلفة',
    'تكلفة الوحدة',
    'التكلفة الإجمالية',
    'مجمل الربح',
    'صافي الربح',
    'هامش الربح',
  ]);
  return rows.map((row) => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!forbiddenKeys.has(k)) {
        clean[k] = v;
      }
    }
    return clean as Partial<T>;
  });
}
