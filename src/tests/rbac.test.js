const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTsModule(relPath) {
  const fullPath = path.join(process.cwd(), relPath);
  const src = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', transpiled.outputText);
  fn(require, mod, mod.exports);
  return mod.exports;
}

const rbac = loadTsModule('src/lib/rbac.ts');
const authSecurity = loadTsModule('src/lib/auth-security.ts');

test('10. اختبار صلاحيات الأدوار الافتراضية (Admin / Cashier / Accountant) والتجاوزات الفردية', () => {
  // Admin يحصل دائماً على كل الصلاحيات
  const adminPerms = rbac.resolveEffectivePermissions({ role: 'admin' });
  for (const key of rbac.ALL_PERMISSIONS) {
    assert.strictEqual(adminPerms[key], true, `يجب أن يملك المدير صلاحية ${key}`);
  }

  // Cashier افتراضياً: POS + مبيعات + مرتجع + عملاء (بدون تكلفة/أرباح/تقارير/موردين/إعدادات/مسحوبات/مستخدمين)
  const cashierPerms = rbac.resolveEffectivePermissions({ role: 'cashier' });
  assert.strictEqual(cashierPerms['pos.view'], true);
  assert.strictEqual(cashierPerms['pos.create'], true);
  assert.strictEqual(cashierPerms['sales.view'], true);
  assert.strictEqual(cashierPerms['customers.view'], true);
  assert.strictEqual(cashierPerms['customers.create'], true);
  assert.strictEqual(cashierPerms['finance.view_cost_profit'], false);
  assert.strictEqual(cashierPerms['reports.view'], false);
  assert.strictEqual(cashierPerms['suppliers.view'], false);
  assert.strictEqual(cashierPerms['withdrawals.view'], false);
  assert.strictEqual(cashierPerms['settings.view'], false);
  assert.strictEqual(cashierPerms['users.manage'], false);
  assert.strictEqual(cashierPerms['audit.view'], false);
  assert.strictEqual(cashierPerms['pos.apply_discount'], false);
  assert.strictEqual(cashierPerms['sales.view_all'], false);

  // Accountant افتراضياً: مصروفات + موردين + تقارير + مخزون + درج + تكلفة/أرباح (بدون POS افتراضياً)
  const accPerms = rbac.resolveEffectivePermissions({ role: 'accountant' });
  assert.strictEqual(accPerms['expenses.view'], true);
  assert.strictEqual(accPerms['expenses.create'], true);
  assert.strictEqual(accPerms['suppliers.view'], true);
  assert.strictEqual(accPerms['suppliers.manage'], true);
  assert.strictEqual(accPerms['reports.view'], true);
  assert.strictEqual(accPerms['inventory.view'], true);
  assert.strictEqual(accPerms['drawer.view'], true);
  assert.strictEqual(accPerms['finance.view_cost_profit'], true);
  assert.strictEqual(accPerms['pos.view'], false);
  assert.strictEqual(accPerms['pos.create'], false);
  assert.strictEqual(accPerms['users.manage'], false);

  // التجاوزات الفردية (Allow / Deny) تتغلب على الدور الافتراضي فوراً
  const overriddenCashier = rbac.resolveEffectivePermissions({
    role: 'cashier',
    userOverrides: {
      'pos.apply_discount': true,
      'customers.create': false,
    },
  });
  assert.strictEqual(overriddenCashier['pos.apply_discount'], true);
  assert.strictEqual(overriddenCashier['customers.create'], false);
});

test('11. اختبار حظر المسارات المباشرة (URL Access Guard) والصفحة الافتراضية لكل دور', () => {
  const cashierPerms = rbac.resolveEffectivePermissions({ role: 'cashier' });
  assert.strictEqual(rbac.canAccessRoute('/sales/new', cashierPerms), true);
  assert.strictEqual(rbac.canAccessRoute('/sales', cashierPerms), true);
  assert.strictEqual(rbac.canAccessRoute('/customers', cashierPerms), true);
  assert.strictEqual(rbac.canAccessRoute('/reports', cashierPerms), false);
  assert.strictEqual(rbac.canAccessRoute('/suppliers', cashierPerms), false);
  assert.strictEqual(rbac.canAccessRoute('/settings', cashierPerms), false);
  assert.strictEqual(rbac.canAccessRoute('/users', cashierPerms), false);
  assert.strictEqual(rbac.canAccessRoute('/audit-log', cashierPerms), false);
  assert.strictEqual(rbac.canAccessRoute('/no-permission', cashierPerms), true);
  assert.strictEqual(rbac.getDefaultHomeRoute(cashierPerms), '/sales/new');

  const accPerms = rbac.resolveEffectivePermissions({ role: 'accountant' });
  assert.strictEqual(rbac.canAccessRoute('/reports', accPerms), true);
  assert.strictEqual(rbac.canAccessRoute('/expenses', accPerms), true);
  assert.strictEqual(rbac.canAccessRoute('/suppliers', accPerms), true);
  assert.strictEqual(rbac.canAccessRoute('/sales/new', accPerms), false);
  assert.strictEqual(rbac.canAccessRoute('/users', accPerms), false);
  assert.strictEqual(rbac.getDefaultHomeRoute(accPerms), '/reports');
});

test('12. اختبار منع حذف أو تعطيل أو تخفيض صلاحية آخر مدير (Last Admin Guard)', () => {
  for (const action of ['delete', 'deactivate', 'demote']) {
    const blocked = rbac.canManageAdminChange({
      activeAdminCount: 1,
      targetIsActiveAdmin: true,
      action,
    });
    assert.strictEqual(blocked.allowed, false, `يجب منع ${action} لآخر مدير نشط`);
  }

  const allowedWhenTwoAdmins = rbac.canManageAdminChange({
    activeAdminCount: 2,
    targetIsActiveAdmin: true,
    action: 'demote',
  });
  assert.strictEqual(allowedWhenTwoAdmins.allowed, true);
});

test('13. اختبار إخفاء التكلفة والأرباح والهامش في الـ API والتصدير لمن لا يملك صلاحية finance.view_cost_profit', () => {
  const sampleProduct = { id: 'p1', name: 'مفتاح مشفر', costPrice: 120, extraCost: 15, salePrice: 250, margin: 46 };
  const redactedProd = rbac.redactCostAndProfitFromProduct(sampleProduct, false);
  assert.strictEqual(redactedProd.costPrice, 0);
  assert.strictEqual(redactedProd.extraCost, 0);
  assert.strictEqual(redactedProd.margin, null);
  assert.strictEqual(redactedProd.salePrice, 250);

  const sampleInv = {
    id: 'inv1',
    totalAmount: 500,
    totalCost: 270,
    grossProfit: 230,
    items: [{ productName: 'مفتاح', unitPrice: 250, unitCost: 135, lineCost: 270, lineProfit: 230 }],
  };
  const redactedInv = rbac.redactCostAndProfitFromInvoice(sampleInv, false);
  assert.strictEqual(redactedInv.totalCost, 0);
  assert.strictEqual(redactedInv.grossProfit, 0);
  assert.strictEqual(redactedInv.items[0].unitCost, 0);
  assert.strictEqual(redactedInv.items[0].lineProfit, 0);

  const exportRows = [
    { 'الصنف': 'مفتاح', 'سعر البيع': 250, 'التكلفة': 120, 'مجمل الربح': 130, 'صافي الربح': 90 },
  ];
  const sanitizedExport = rbac.sanitizeExportDataByPermission(exportRows, false);
  assert.strictEqual('التكلفة' in sanitizedExport[0], false);
  assert.strictEqual('مجمل الربح' in sanitizedExport[0], false);
  assert.strictEqual('صافي الربح' in sanitizedExport[0], false);
  assert.strictEqual(sanitizedExport[0]['سعر البيع'], 250);
});

test('14. اختبار حد محاولات الدخول الفاشلة (Rate Limit) ومهلة إغلاق الجلسة التلقائي', () => {
  const limiter = new authSecurity.LoginRateLimiter();
  const baseNow = 1_700_000_000_000;
  for (let i = 1; i <= 4; i++) {
    const res = limiter.recordFailure('karem@shop.com', '127.0.0.1', baseNow + i * 1000);
    assert.strictEqual(res.locked, false);
    assert.strictEqual(limiter.check('karem@shop.com', '127.0.0.1', baseNow + i * 1000).allowed, true);
  }
  const fifth = limiter.recordFailure('karem@shop.com', '127.0.0.1', baseNow + 5000);
  assert.strictEqual(fifth.locked, true);
  assert.strictEqual(limiter.check('karem@shop.com', '127.0.0.1', baseNow + 6000).allowed, false);

  // بعد 16 دقيقة ينفك القفل
  assert.strictEqual(
    limiter.check('karem@shop.com', '127.0.0.1', baseNow + 16 * 60 * 1000).allowed,
    true
  );

  // مسح السجل بعد النجاح
  limiter.recordFailure('cashier@shop.com', '127.0.0.1', baseNow);
  limiter.clear('cashier@shop.com', '127.0.0.1');
  assert.strictEqual(limiter.check('cashier@shop.com', '127.0.0.1', baseNow + 100).allowed, true);

  // اختبار مهلة الخمول
  assert.strictEqual(authSecurity.isSessionTimedOut(baseNow, 30, baseNow + 29 * 60 * 1000), false);
  assert.strictEqual(authSecurity.isSessionTimedOut(baseNow, 30, baseNow + 31 * 60 * 1000), true);
});

test('15. التحقق من وجود حواجز الأمان في Middleware ومسارات الـ API وملف Migration 6', () => {
  const mw = fs.readFileSync(path.join(process.cwd(), 'src/middleware.ts'), 'utf8');
  assert.ok(mw.includes('canAccessRoute'), 'middleware.ts يجب أن يتحقق من canAccessRoute');
  assert.ok(mw.includes('/no-permission'), 'middleware.ts يجب أن يوجه لـ /no-permission');
  assert.ok(mw.includes('deactivated=1'), 'middleware.ts يجب أن يمنع الحسابات الموقفة');

  const apiFiles = [
    'src/app/api/admin/users/route.ts',
    'src/app/api/admin/users/[id]/route.ts',
    'src/app/api/admin/roles/route.ts',
    'src/app/api/settings/security/route.ts',
    'src/app/api/shop/data/route.ts',
  ];
  for (const rel of apiFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    assert.ok(content.includes('requireServerAuth'), `${rel} يجب أن يستدعي requireServerAuth`);
  }

  const migration6 = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261125_000006_rbac_audit_security.sql'),
    'utf8'
  );
  for (const sqlSymbol of [
    'CREATE TABLE IF NOT EXISTS public.roles',
    'CREATE TABLE IF NOT EXISTS public.role_permissions',
    'CREATE TABLE IF NOT EXISTS public.user_permission_overrides',
    'CREATE OR REPLACE FUNCTION public.has_permission',
    'protect_profile_security',
    'enforce_drawer_session_permissions',
    'enforce_sale_discount_permission',
    'check_login_rate_limit',
    'record_failed_login',
  ]) {
    assert.ok(migration6.includes(sqlSymbol), `Migration 6 يجب أن يحتوي على ${sqlSymbol}`);
  }
});

test('16. منع التسجيل العام وحصر تعديل اسم المحل بالمدير وتسريع تسجيل الدخول', () => {
  const loginPage = fs.readFileSync(path.join(process.cwd(), 'src/app/login/page.tsx'), 'utf8');
  const loginClient = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/login-client.tsx'), 'utf8');
  assert.strictEqual(fs.existsSync(path.join(process.cwd(), 'src/app/signup/page.tsx')), false);
  assert.strictEqual(loginPage.includes('signUp') || loginClient.includes('signUp'), false, 'يجب إزالة signUp من شاشة الدخول');
  assert.strictEqual(loginClient.includes('إنشاء متجر جديد'), false, 'يجب إزالة رابط إنشاء حساب من شاشة الدخول');
  assert.strictEqual(loginClient.includes('router.refresh()'), false, 'يجب عدم تكرار طلبات الدخول عبر router.refresh');

  const signupApi = fs.readFileSync(path.join(process.cwd(), 'src/app/api/auth/signup/route.ts'), 'utf8');
  assert.ok(signupApi.includes('status: 403'), 'نقطة /api/auth/signup يجب أن ترفض الطلبات برمز 403');

  const mw = fs.readFileSync(path.join(process.cwd(), 'src/middleware.ts'), 'utf8');
  assert.strictEqual(mw.includes("'/no-permission',\n"), false, 'لا يجب استثناء /no-permission لغير المسجلين في SKIP_PATHS');

  const shopApi = fs.readFileSync(path.join(process.cwd(), 'src/app/api/settings/shop/route.ts'), 'utf8');
  assert.ok(shopApi.includes("role !== 'admin'"), 'تعديل اسم المحل يجب أن يُقصر على admin فقط');

  const loginApi = fs.readFileSync(path.join(process.cwd(), 'src/app/api/auth/login/route.ts'), 'utf8');
  assert.ok(loginApi.includes('Promise.all'), 'تسجيل الدخول يجب أن يشغل فحص المعدل والدخول بالتوازي');
  assert.ok(loginApi.includes('finalize_user_login'), 'تسجيل الدخول يجب أن يستخدم finalize_user_login السريعة');

  const migration7 = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261127_000007_block_public_signup_and_login_perf.sql'),
    'utf8'
  );
  for (const sym of [
    'التسجيل العام معطّل',
    'protect_shop_admin_fields',
    'get_public_shop_name',
    'finalize_user_login',
    'get_middleware_auth_context',
  ]) {
    assert.ok(migration7.includes(sym), `Migration 7 يجب أن يحتوي على ${sym}`);
  }
});
