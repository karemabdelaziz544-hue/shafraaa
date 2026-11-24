-- Migration 3: Create supplier_payments and enhance damaged_items table with RLS and audit trails
-- محل شفرة - المالك: كريم

-- 1. جدول مدفوعات وسدادات الموردين (supplier_payments)
CREATE TABLE IF NOT EXISTS supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wallet', 'instapay', 'bank', 'credit')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    drawer_session_id UUID REFERENCES drawer_sessions(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس جدول مدفوعات الموردين
CREATE INDEX IF NOT EXISTS idx_supplier_payments_shop ON supplier_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

-- تفعيل RLS لجدول مدفوعات الموردين
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop's supplier payments" ON supplier_payments;
CREATE POLICY "Users can view their shop's supplier payments"
    ON supplier_payments FOR SELECT
    USING (shop_id IN (SELECT shop_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their shop's supplier payments" ON supplier_payments;
CREATE POLICY "Users can insert their shop's supplier payments"
    ON supplier_payments FOR INSERT
    WITH CHECK (shop_id IN (SELECT shop_id FROM profiles WHERE id = auth.uid()));


-- 2. جدول الهالك والتوالف (damaged_items)
CREATE TABLE IF NOT EXISTS damaged_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    total_loss NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_loss >= 0),
    reason TEXT NOT NULL,
    notes TEXT,
    damage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- التأكد من وجود أعمدة damage_date و notes في حال كان الجدول منشأ سابقاً
ALTER TABLE IF EXISTS damaged_items 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS damage_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- فهارس جدول الهالك والتوالف
CREATE INDEX IF NOT EXISTS idx_damaged_items_shop ON damaged_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_damaged_items_product ON damaged_items(product_id);
CREATE INDEX IF NOT EXISTS idx_damaged_items_date ON damaged_items(damage_date);

-- تفعيل RLS لجدول الهالك والتوالف
ALTER TABLE damaged_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their shop's damaged items" ON damaged_items;
CREATE POLICY "Users can view their shop's damaged items"
    ON damaged_items FOR SELECT
    USING (shop_id IN (SELECT shop_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their shop's damaged items" ON damaged_items;
CREATE POLICY "Users can insert their shop's damaged items"
    ON damaged_items FOR INSERT
    WITH CHECK (shop_id IN (SELECT shop_id FROM profiles WHERE id = auth.uid()));
