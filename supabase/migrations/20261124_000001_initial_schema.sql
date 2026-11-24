-- ============================================================================
-- نظام إدارة محل التجزئة - شفرة (Shafra)
-- المالك: كريم (Karem)
-- العملة: الجنيه المصري (EGP / ج.م)
-- قواعد البيانات: PostgreSQL / Supabase
-- ميزات: RLS, Multi-tenant (shop_id), Soft Deletes, Audit Logs, Money as NUMERIC(12,2)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. المحلات (Shops)
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'محل شفرة',
    owner_name TEXT NOT NULL DEFAULT 'كريم',
    phone TEXT,
    address TEXT,
    currency TEXT NOT NULL DEFAULT 'EGP',
    tax_rate NUMERIC(5,2) DEFAULT 0.00,
    receipt_header TEXT DEFAULT 'أهلًا بكم في محل شفرة',
    receipt_footer TEXT DEFAULT 'البضاعة المباعة ترد وتستبدل خلال 14 يومًا بالفاتورة ما لم تكن تالفة',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2. ملفات المستخدمين والأدوار (Profiles)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('owner', 'cashier', 'accountant')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. تصنيفات المنتجات (Categories)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 4. المنتجات (Products)
-- التكلفة + مصاريف إضافية + سعر البيع + هامش الربح المحسوب
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    barcode TEXT,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    extra_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (extra_cost >= 0),
    sale_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (sale_price >= 0),
    opening_stock NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    min_stock_alert NUMERIC(12,2) NOT NULL DEFAULT 5.00,
    unit TEXT NOT NULL DEFAULT 'قطعة',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 5. سجل تغير الأسعار (Price History)
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_cost NUMERIC(12,2) NOT NULL,
    new_cost NUMERIC(12,2) NOT NULL,
    old_sale NUMERIC(12,2) NOT NULL,
    new_sale NUMERIC(12,2) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. العملاء (Customers)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- موجب = عليه فلوس للمحل
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 7. حركات العملاء (Customer Transactions)
CREATE TABLE IF NOT EXISTS customer_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('invoice', 'payment', 'return', 'adjustment')),
    amount NUMERIC(12,2) NOT NULL, -- موجب للمديونية، سالب للسداد
    payment_method TEXT CHECK (payment_method IN ('cash', 'wallet', 'instapay', 'credit', 'bank')),
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. الموردين (Suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    owed_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- موجب = المحل عليه فلوس للمورد
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 9. حركات الموردين (Supplier Transactions)
CREATE TABLE IF NOT EXISTS supplier_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'payment', 'return', 'adjustment')),
    amount NUMERIC(12,2) NOT NULL, -- موجب لمستحق المورد، سالب للسداد
    payment_method TEXT CHECK (payment_method IN ('cash', 'wallet', 'instapay', 'bank')),
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. جلسات الدرج اليومية (Drawer Sessions)
CREATE TABLE IF NOT EXISTS drawer_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    session_number SERIAL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_returns NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_customer_debt_payments NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_supplier_payments NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_expenses NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_withdrawals NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    actual_cash NUMERIC(12,2),
    difference NUMERIC(12,2), -- سالب = عجز، موجب = زيادة
    wallet_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    instapay_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    closing_notes TEXT,
    opened_by UUID REFERENCES auth.users(id),
    closed_by UUID REFERENCES auth.users(id),
    reopened_by UUID REFERENCES auth.users(id),
    reopened_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. فواتير المبيعات (Sales Invoices)
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    gross_profit NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- total_amount - total_cost
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- يسجل كدين على العميل
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'wallet', 'instapay', 'credit', 'split')),
    payment_breakdown JSONB, -- تفصيل المبالغ عند الدفع المقسم (كاش + محفظة + إلخ)
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'returned_partial', 'returned_full', 'cancelled')),
    drawer_session_id UUID REFERENCES drawer_sessions(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 12. بنود فاتورة المبيعات (Sales Invoice Items)
-- الاحتفاظ بالتكلفة وسعر البيع الفعلي وقت البيع لحفظ الأرباح القديمة من التغير
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    barcode TEXT,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12,2) NOT NULL,
    line_cost NUMERIC(12,2) NOT NULL,
    line_profit NUMERIC(12,2) NOT NULL,
    returned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. مرتجعات المبيعات (Sales Returns)
CREATE TABLE IF NOT EXISTS sales_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    return_number TEXT NOT NULL,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    refund_method TEXT NOT NULL CHECK (refund_method IN ('cash', 'wallet', 'instapay', 'credit_balance')),
    drawer_session_id UUID REFERENCES drawer_sessions(id) ON DELETE SET NULL,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. بنود المرتجعات (Sales Return Items)
CREATE TABLE IF NOT EXISTS sales_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    invoice_item_id UUID REFERENCES sales_invoice_items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_refund_price NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('sellable', 'damaged')), -- سليم يعود للمخزون، تالف يسجل خسارة
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. فواتير المشتريات والتوريد (Purchase Invoices)
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'wallet', 'instapay', 'credit', 'bank')),
    drawer_session_id UUID REFERENCES drawer_sessions(id) ON DELETE SET NULL,
    invoice_photo_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 16. بنود فواتير المشتريات (Purchase Invoice Items)
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. الهوالك والتوالف (Damaged Items / Inventory Losses)
CREATE TABLE IF NOT EXISTS damaged_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12,2) NOT NULL,
    total_loss NUMERIC(12,2) NOT NULL, -- quantity * unit_cost
    reason TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. جلسات الجرد الفعلي للمخزون (Physical Inventory Counts)
CREATE TABLE IF NOT EXISTS physical_inventory_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    count_number SERIAL,
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
    total_variance_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. بنود الجرد الفعلي (Physical Inventory Items)
CREATE TABLE IF NOT EXISTS physical_inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    count_id UUID NOT NULL REFERENCES physical_inventory_counts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    system_stock NUMERIC(12,2) NOT NULL,
    counted_stock NUMERIC(12,2) NOT NULL,
    variance NUMERIC(12,2) NOT NULL, -- counted_stock - system_stock
    unit_cost NUMERIC(12,2) NOT NULL,
    variance_cost NUMERIC(12,2) NOT NULL, -- variance * unit_cost
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 20. المصروفات (Expenses - Fixed & Variable)
-- المصروفات الثابتة (إيجار، كهرباء، رواتب) تخصم مرة واحدة فقط في حساب صافي ربح الفترة
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('fixed', 'variable')),
    category TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'wallet', 'instapay', 'bank')),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    drawer_session_id UUID REFERENCES drawer_sessions(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 21. مسحوبات المالك الشخصية (Owner Withdrawals)
-- ليست مصروفاً في قائمة الدخل ولا تخصم من الأرباح بل من النقدية وحقوق المالك
CREATE TABLE IF NOT EXISTS owner_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'wallet', 'instapay')),
    withdrawal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    drawer_session_id UUID REFERENCES drawer_sessions(id) ON DELETE SET NULL,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 23. سجل التدقيق والمراقبة (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE, REOPEN, APPROVE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- الفهارس لتحسين سرعة الاستعلام (Indexes)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_shop_barcode ON products(shop_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_shop_name ON products(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_shop_phone ON customers(shop_id, phone);
CREATE INDEX IF NOT EXISTS idx_suppliers_shop_phone ON suppliers(shop_id, phone);
CREATE INDEX IF NOT EXISTS idx_sales_shop_date ON sales_invoices(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_items_product ON sales_invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_date ON expenses(shop_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_drawer_shop_status ON drawer_sessions(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_shop_table ON audit_logs(shop_id, table_name, record_id);

-- ============================================================================
-- العروض الإحصائية (Views)
-- ============================================================================

-- عرض مقارنة المخزون المحسوب من الحركات
CREATE OR REPLACE VIEW view_stock_balance AS
SELECT 
    p.id AS product_id,
    p.shop_id,
    p.name,
    p.barcode,
    p.opening_stock,
    p.current_stock,
    p.cost_price,
    p.sale_price,
    (p.current_stock * p.cost_price) AS stock_value_at_cost,
    (p.current_stock <= p.min_stock_alert) AS is_low_stock
FROM products p
WHERE p.deleted_at IS NULL;

-- عرض تقرير اليومية المالية المباشر
CREATE OR REPLACE VIEW view_daily_financial_summary AS
SELECT 
    si.shop_id,
    DATE(si.created_at) AS report_date,
    COUNT(si.id) AS total_invoices_count,
    COALESCE(SUM(si.total_amount), 0.00) AS total_sales,
    COALESCE(SUM(si.total_cost), 0.00) AS total_cost_of_goods,
    COALESCE(SUM(si.gross_profit), 0.00) AS total_gross_profit,
    COALESCE(SUM(si.paid_amount), 0.00) AS total_paid_amount,
    COALESCE(SUM(si.remaining_amount), 0.00) AS total_unpaid_debt
FROM sales_invoices si
WHERE si.deleted_at IS NULL
GROUP BY si.shop_id, DATE(si.created_at);

-- ============================================================================
-- سياسات الأمان على مستوى الصف (Row Level Security - RLS)
-- ============================================================================
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE damaged_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- دالة مساعدة للحصول على معرف المحل للمستخدم الحالي
CREATE OR REPLACE FUNCTION get_current_user_shop_id()
RETURNS UUID AS $$
    SELECT shop_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- تطبيق سياسات العزل للمحل على كل الجداول
CREATE POLICY "Users can only access their own shop" ON shops
    FOR ALL USING (id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop profiles" ON profiles
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop categories" ON categories
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop products" ON products
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop price history" ON price_history
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop customers" ON customers
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop customer transactions" ON customer_transactions
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop suppliers" ON suppliers
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop supplier transactions" ON supplier_transactions
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop drawer sessions" ON drawer_sessions
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop sales invoices" ON sales_invoices
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop sales invoice items" ON sales_invoice_items
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop returns" ON sales_returns
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop return items" ON sales_return_items
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop purchase invoices" ON purchase_invoices
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop purchase items" ON purchase_invoice_items
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop damaged items" ON damaged_items
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop inventory counts" ON physical_inventory_counts
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop inventory count items" ON physical_inventory_items
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop expenses" ON expenses
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop owner withdrawals" ON owner_withdrawals
    FOR ALL USING (shop_id = get_current_user_shop_id());

CREATE POLICY "Users can only access their shop audit logs" ON audit_logs
    FOR ALL USING (shop_id = get_current_user_shop_id());
