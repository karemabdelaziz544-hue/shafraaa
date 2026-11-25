-- Migration 6: Complete RBAC (Roles, Permissions, Overrides), User Invitations, Audit Fields, Rate Limiting & RLS Enforcement
-- محل شفرة - المالك: كريم

-- 1. توسيع جدول المحلات وجدول الملفات الشخصية وجدول التدقيق والفواتير والدرج
ALTER TABLE IF EXISTS public.shops
ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER NOT NULL DEFAULT 120 CHECK (session_timeout_minutes >= 5);

ALTER TABLE IF EXISTS public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE IF EXISTS public.profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'owner', 'cashier', 'accountant'));

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- ترحيل المالكين الحاليين إلى دور admin (مع الحفاظ على التوافق) ومزامنة البريد الإلكتروني
UPDATE public.profiles SET role = 'admin' WHERE role = 'owner';

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

ALTER TABLE IF EXISTS public.audit_logs
ADD COLUMN IF NOT EXISTS actor_name TEXT,
ADD COLUMN IF NOT EXISTS actor_role TEXT;

ALTER TABLE IF EXISTS public.audit_logs
ALTER COLUMN record_id SET DEFAULT gen_random_uuid();

ALTER TABLE IF EXISTS public.sales_invoices ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE IF EXISTS public.purchase_invoices ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE IF EXISTS public.expenses ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE IF EXISTS public.owner_withdrawals ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE IF EXISTS public.damaged_items ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE IF EXISTS public.drawer_sessions
ADD COLUMN IF NOT EXISTS opened_by_name TEXT,
ADD COLUMN IF NOT EXISTS closed_by_name TEXT,
ADD COLUMN IF NOT EXISTS reopened_by_name TEXT;

-- 2. جداول الأدوار والصلاحيات والاستثناءات والدعوات ومحاولات الدخول
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL CHECK (role_key IN ('admin', 'cashier', 'accountant')),
    display_name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, role_key)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL CHECK (role_key IN ('admin', 'cashier', 'accountant')),
    permission_key TEXT NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    allowed BOOLEAN NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, user_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier', 'accountant')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    invited_by UUID REFERENCES auth.users(id),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, email)
);

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL DEFAULT 'unknown',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (email, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_lookup ON public.role_permissions(shop_id, role_key, permission_key);
CREATE INDEX IF NOT EXISTS idx_user_overrides_lookup ON public.user_permission_overrides(shop_id, user_id, permission_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_user_date ON public.audit_logs(shop_id, changed_by, created_at DESC);

-- 3. دوال الصلاحيات الأساسية (SECURITY DEFINER + search_path = public)
CREATE OR REPLACE FUNCTION public.get_current_user_shop_id()
RETURNS UUID AS $$
    SELECT shop_id
    FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
    SELECT CASE WHEN role = 'owner' THEN 'admin' ELSE role END
    FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_shop_id UUID;
    v_role TEXT;
    v_override BOOLEAN;
    v_role_allowed BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT shop_id, CASE WHEN role = 'owner' THEN 'admin' ELSE role END
    INTO v_shop_id, v_role
    FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
    LIMIT 1;

    IF v_shop_id IS NULL OR v_role IS NULL THEN
        RETURN false;
    END IF;

    IF v_role = 'admin' THEN
        RETURN true;
    END IF;

    SELECT allowed INTO v_override
    FROM public.user_permission_overrides
    WHERE shop_id = v_shop_id AND user_id = auth.uid() AND permission_key = p_permission
    LIMIT 1;

    IF FOUND THEN
        RETURN COALESCE(v_override, false);
    END IF;

    SELECT allowed INTO v_role_allowed
    FROM public.role_permissions
    WHERE shop_id = v_shop_id AND role_key = v_role AND permission_key = p_permission
    LIMIT 1;

    RETURN COALESCE(v_role_allowed, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_current_user_shop_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated, anon;

-- 4. دالة بذر الأدوار والصلاحيات الافتراضية لكل متجر
CREATE OR REPLACE FUNCTION public.seed_shop_rbac(p_shop_id UUID)
RETURNS VOID AS $$
DECLARE
    all_perms TEXT[] := ARRAY[
        'dashboard.view', 'finance.view_cost_profit', 'export.data',
        'pos.view', 'pos.create', 'pos.apply_discount', 'sales.view', 'sales.view_all', 'sales.process_return',
        'products.view', 'products.create', 'products.edit', 'products.delete',
        'customers.view', 'customers.create', 'customers.edit', 'customers.collect_payment',
        'suppliers.view', 'suppliers.manage',
        'inventory.view', 'inventory.manage',
        'expenses.view', 'expenses.create',
        'drawer.view', 'drawer.open_close', 'drawer.reopen',
        'reports.view', 'withdrawals.view', 'withdrawals.create',
        'import.view', 'import.execute',
        'settings.view', 'settings.manage',
        'users.manage', 'audit.view'
    ];
    cashier_defaults TEXT[] := ARRAY[
        'pos.view', 'pos.create', 'sales.view', 'sales.process_return',
        'customers.view', 'customers.create'
    ];
    accountant_defaults TEXT[] := ARRAY[
        'expenses.view', 'expenses.create',
        'suppliers.view', 'suppliers.manage',
        'reports.view', 'inventory.view', 'drawer.view',
        'finance.view_cost_profit', 'export.data'
    ];
    perm TEXT;
BEGIN
    INSERT INTO public.roles (shop_id, role_key, display_name, description) VALUES
        (p_shop_id, 'admin', 'مدير النظام (المالك)', 'صلاحيات كاملة لإدارة المحل والمستخدمين'),
        (p_shop_id, 'cashier', 'كاشير', 'نقطة البيع والفواتير الخاصة والعملاء'),
        (p_shop_id, 'accountant', 'محاسب', 'المصروفات والموردين والتقارير والمخزون وتاريخ الدرج')
    ON CONFLICT (shop_id, role_key) DO NOTHING;

    FOREACH perm IN ARRAY all_perms LOOP
        INSERT INTO public.role_permissions (shop_id, role_key, permission_key, allowed)
        VALUES (p_shop_id, 'admin', perm, true)
        ON CONFLICT (shop_id, role_key, permission_key) DO NOTHING;

        INSERT INTO public.role_permissions (shop_id, role_key, permission_key, allowed)
        VALUES (p_shop_id, 'cashier', perm, perm = ANY(cashier_defaults))
        ON CONFLICT (shop_id, role_key, permission_key) DO NOTHING;

        INSERT INTO public.role_permissions (shop_id, role_key, permission_key, allowed)
        VALUES (p_shop_id, 'accountant', perm, perm = ANY(accountant_defaults))
        ON CONFLICT (shop_id, role_key, permission_key) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.seed_shop_rbac(UUID) TO authenticated, service_role;

-- تطبيق البذر على كافة المتاجر الموجودة حالياً
DO $$
DECLARE
    s RECORD;
BEGIN
    FOR s IN SELECT id FROM public.shops LOOP
        PERFORM public.seed_shop_rbac(s.id);
    END LOOP;
END $$;

-- 5. تحديث تريجر إنشاء الحساب لدعم الدعوات المرتبطة بنفس المتجر
CREATE OR REPLACE FUNCTION public.handle_new_user_shop_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_shop_id UUID;
    v_full_name TEXT;
    v_role TEXT;
    v_invite RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- أولاً: التحقق من وجود دعوة معتمدة من مدير متجر لهذا البريد
    SELECT * INTO v_invite
    FROM public.user_invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        INSERT INTO public.profiles (id, shop_id, full_name, email, role, is_active, created_by)
        VALUES (
            NEW.id,
            v_invite.shop_id,
            COALESCE(NULLIF(v_invite.full_name, ''), NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            NEW.email,
            CASE WHEN v_invite.role IN ('admin', 'cashier', 'accountant') THEN v_invite.role ELSE 'cashier' END,
            COALESCE(v_invite.is_active, true),
            v_invite.invited_by
        );

        UPDATE public.user_invitations
        SET accepted_at = now()
        WHERE id = v_invite.id;

        RETURN NEW;
    END IF;

    -- تسجيل مالك جديد بمتجر مستقل
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'المالك');
    v_role := 'admin';

    INSERT INTO public.shops (name, owner_name)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'shop_name', 'محل ' || v_full_name),
        v_full_name
    )
    RETURNING id INTO v_shop_id;

    INSERT INTO public.profiles (id, shop_id, full_name, email, role, is_active)
    VALUES (NEW.id, v_shop_id, v_full_name, NEW.email, v_role, true);

    PERFORM public.seed_shop_rbac(v_shop_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. تريجرات الحماية الصارمة على مستوى قاعدة البيانات
-- أ. حماية آخر مدير ومنع رفع الصلاحيات الذاتي
CREATE OR REPLACE FUNCTION public.protect_profile_security()
RETURNS TRIGGER AS $$
DECLARE
    v_other_admins INTEGER;
    v_is_admin_caller BOOLEAN;
    v_old_role TEXT;
    v_new_role TEXT;
BEGIN
    -- السماح لـ service_role / postgres بإدارة النظام مع استمرار حماية آخر مدير
    v_is_admin_caller := (auth.uid() IS NULL) OR public.has_permission('users.manage');

    IF TG_OP = 'DELETE' THEN
        v_old_role := CASE WHEN OLD.role = 'owner' THEN 'admin' ELSE OLD.role END;
        IF v_old_role = 'admin' AND OLD.is_active THEN
            SELECT COUNT(*) INTO v_other_admins
            FROM public.profiles
            WHERE shop_id = OLD.shop_id
              AND id <> OLD.id
              AND (role = 'admin' OR role = 'owner')
              AND is_active = true;
            IF v_other_admins = 0 THEN
                RAISE EXCEPTION 'لا يمكن حذف آخر مدير نشط في النظام';
            END IF;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        v_old_role := CASE WHEN OLD.role = 'owner' THEN 'admin' ELSE OLD.role END;
        v_new_role := CASE WHEN NEW.role = 'owner' THEN 'admin' ELSE NEW.role END;

        IF NOT v_is_admin_caller THEN
            IF v_new_role IS DISTINCT FROM v_old_role OR NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
                RAISE EXCEPTION 'غير مصرح لك بتغيير الدور الوظيفي أو حالة التفعيل';
            END IF;
        END IF;

        IF v_old_role = 'admin' AND OLD.is_active AND (v_new_role <> 'admin' OR NEW.is_active = false) THEN
            SELECT COUNT(*) INTO v_other_admins
            FROM public.profiles
            WHERE shop_id = OLD.shop_id
              AND id <> OLD.id
              AND (role = 'admin' OR role = 'owner')
              AND is_active = true;
            IF v_other_admins = 0 THEN
                RAISE EXCEPTION 'لا يمكن إيقاف أو تخفيض صلاحية آخر مدير نشط في النظام';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_security ON public.profiles;
CREATE TRIGGER trg_protect_profile_security
    BEFORE UPDATE OR DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_security();

-- ب. حماية فتح/إغلاق/إعادة فتح الدرج
CREATE OR REPLACE FUNCTION public.enforce_drawer_session_permissions()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NOT public.has_permission('drawer.open_close') THEN
            RAISE EXCEPTION 'لا تملك صلاحية فتح وردية درج جديدة';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'closed' AND NEW.status = 'open' THEN
            IF NOT public.has_permission('drawer.reopen') THEN
                RAISE EXCEPTION 'لا تملك صلاحية إعادة فتح الدرج المغلق';
            END IF;
        ELSIF OLD.status = 'open' AND NEW.status = 'closed' THEN
            IF NOT public.has_permission('drawer.open_close') THEN
                RAISE EXCEPTION 'لا تملك صلاحية تقفيل وإغلاق الدرج';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_drawer_permissions ON public.drawer_sessions;
CREATE TRIGGER trg_enforce_drawer_permissions
    BEFORE INSERT OR UPDATE ON public.drawer_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_drawer_session_permissions();

-- ج. حماية صلاحية تطبيق الخصم عند البيع
CREATE OR REPLACE FUNCTION public.enforce_sale_discount_permission()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND COALESCE(NEW.discount, 0) > 0 THEN
        IF NOT public.has_permission('pos.apply_discount') THEN
            RAISE EXCEPTION 'لا تملك صلاحية تطبيق خصم على فاتورة البيع';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_sale_discount ON public.sales_invoices;
CREATE TRIGGER trg_enforce_sale_discount
    BEFORE INSERT ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_sale_discount_permission();

-- 7. تحديث دالة المرتجع للتحقق من الصلاحية وملكية الفاتورة
CREATE OR REPLACE FUNCTION public.process_sale_return(
    p_invoice_id UUID,
    p_invoice_item_id UUID,
    p_quantity NUMERIC,
    p_refund_amount NUMERIC,
    p_refund_method TEXT,
    p_is_sellable BOOLEAN,
    p_reason TEXT,
    p_drawer_session_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_shop_id UUID;
    v_user_id UUID;
    v_user_name TEXT;
    v_user_role TEXT;
    v_invoice RECORD;
    v_item RECORD;
    v_remaining NUMERIC(12,2);
    v_new_returned NUMERIC(12,2);
    v_total_sold NUMERIC(12,2);
    v_total_returned NUMERIC(12,2);
    v_next_status TEXT;
    v_return_id UUID;
    v_return_number TEXT;
    v_normalized_method TEXT;
    v_unit_refund NUMERIC(12,2);
    v_drawer RECORD;
    v_next_cash_returns NUMERIC(12,2);
    v_next_expected NUMERIC(12,2);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول لتنفيذ عملية المرتجع';
    END IF;

    SELECT shop_id, full_name, CASE WHEN role = 'owner' THEN 'admin' ELSE role END
    INTO v_shop_id, v_user_name, v_user_role
    FROM public.profiles
    WHERE id = v_user_id AND is_active = true
    LIMIT 1;

    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'الحساب موقوف أو غير مرتبط بمتجر';
    END IF;

    IF NOT public.has_permission('sales.process_return') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية تنفيذ المرتجعات';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'يجب أن تكون الكمية المرتجعة أكبر من صفر';
    END IF;

    SELECT * INTO v_invoice
    FROM public.sales_invoices
    WHERE id = p_invoice_id AND shop_id = v_shop_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الفاتورة غير موجودة';
    END IF;

    IF NOT public.has_permission('sales.view_all') AND v_invoice.created_by IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'غير مصرح لك بإرجاع فواتير تخص مستخدمين آخرين';
    END IF;

    SELECT * INTO v_item
    FROM public.sales_invoice_items
    WHERE id = p_invoice_item_id AND invoice_id = p_invoice_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'بند الفاتورة غير موجود';
    END IF;

    v_remaining := ROUND((v_item.quantity - COALESCE(v_item.returned_quantity, 0))::numeric, 2);

    IF v_remaining <= 0 THEN
        RAISE EXCEPTION 'تم إرجاع كامل كمية هذا الصنف مسبقاً ولا توجد كمية متبقية للإرجاع';
    END IF;

    IF ROUND(p_quantity::numeric, 2) > v_remaining THEN
        RAISE EXCEPTION 'الكمية المطلوب إرجاعها (%) أكبر من الكمية المتبقية القابلة للإرجاع (%)', ROUND(p_quantity::numeric, 2), v_remaining;
    END IF;

    v_new_returned := ROUND((COALESCE(v_item.returned_quantity, 0) + p_quantity)::numeric, 2);
    v_normalized_method := CASE
        WHEN p_refund_method IN ('credit', 'credit_balance') THEN 'credit_balance'
        WHEN p_refund_method IN ('cash', 'wallet', 'instapay') THEN p_refund_method
        ELSE 'cash'
    END;
    v_unit_refund := ROUND((p_refund_amount / p_quantity)::numeric, 2);
    v_return_id := gen_random_uuid();
    v_return_number := 'RET-' || to_char(now(), 'YYYYMMDD') || '-' || substr(v_return_id::text, 1, 6);

    INSERT INTO public.sales_returns (
        id, shop_id, return_number, invoice_id, customer_id,
        refund_amount, refund_method, drawer_session_id, reason, created_by, created_by_name
    ) VALUES (
        v_return_id, v_shop_id, v_return_number, p_invoice_id, v_invoice.customer_id,
        ROUND(p_refund_amount::numeric, 2), v_normalized_method, p_drawer_session_id,
        COALESCE(NULLIF(trim(p_reason), ''), 'مرتجع مبيعات'), v_user_id, COALESCE(v_user_name, 'المستخدم')
    );

    INSERT INTO public.sales_return_items (
        id, shop_id, return_id, invoice_item_id, product_id, product_name,
        quantity, unit_refund_price, unit_cost, condition, line_refund_total
    ) VALUES (
        gen_random_uuid(), v_shop_id, v_return_id, p_invoice_item_id, v_item.product_id, v_item.product_name,
        ROUND(p_quantity::numeric, 2), v_unit_refund, v_item.unit_cost,
        CASE WHEN p_is_sellable THEN 'sellable' ELSE 'damaged' END,
        ROUND(p_refund_amount::numeric, 2)
    );

    UPDATE public.sales_invoice_items
    SET returned_quantity = v_new_returned
    WHERE id = p_invoice_item_id AND shop_id = v_shop_id;

    SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(returned_quantity), 0)
    INTO v_total_sold, v_total_returned
    FROM public.sales_invoice_items
    WHERE invoice_id = p_invoice_id AND shop_id = v_shop_id;

    IF v_total_returned >= v_total_sold AND v_total_sold > 0 THEN
        v_next_status := 'returned_full';
    ELSIF v_total_returned > 0 THEN
        v_next_status := 'returned_partial';
    ELSE
        v_next_status := 'completed';
    END IF;

    IF v_normalized_method = 'credit_balance' AND v_invoice.customer_id IS NOT NULL THEN
        UPDATE public.sales_invoices
        SET status = v_next_status,
            remaining_amount = GREATEST(0, ROUND((remaining_amount - p_refund_amount)::numeric, 2)),
            updated_at = now()
        WHERE id = p_invoice_id AND shop_id = v_shop_id;

        UPDATE public.customers
        SET current_balance = GREATEST(0, ROUND((current_balance - p_refund_amount)::numeric, 2)),
            updated_at = now()
        WHERE id = v_invoice.customer_id AND shop_id = v_shop_id;

        INSERT INTO public.customer_transactions (
            shop_id, customer_id, transaction_type, amount, payment_method, reference_id, notes, created_by
        ) VALUES (
            v_shop_id, v_invoice.customer_id, 'return', -ROUND(p_refund_amount::numeric, 2),
            'credit', v_return_id, 'خصم مرتجع فاتورة #' || v_invoice.invoice_number, v_user_id
        );
    ELSE
        UPDATE public.sales_invoices
        SET status = v_next_status,
            updated_at = now()
        WHERE id = p_invoice_id AND shop_id = v_shop_id;
    END IF;

    IF p_is_sellable AND v_item.product_id IS NOT NULL THEN
        UPDATE public.products
        SET current_stock = ROUND((current_stock + p_quantity)::numeric, 2),
            updated_at = now()
        WHERE id = v_item.product_id AND shop_id = v_shop_id;
    ELSIF NOT p_is_sellable THEN
        INSERT INTO public.damaged_items (
            shop_id, product_id, product_name, quantity, unit_cost, total_loss, reason, notes, damage_date, created_by, created_by_name
        ) VALUES (
            v_shop_id, v_item.product_id, v_item.product_name,
            ROUND(p_quantity::numeric, 2), v_item.unit_cost,
            ROUND((p_quantity * v_item.unit_cost)::numeric, 2),
            'مرتجع تالف من فاتورة #' || v_invoice.invoice_number,
            p_reason, CURRENT_DATE, v_user_id, COALESCE(v_user_name, 'المستخدم')
        );
    END IF;

    IF p_drawer_session_id IS NOT NULL AND v_normalized_method = 'cash' THEN
        SELECT * INTO v_drawer
        FROM public.drawer_sessions
        WHERE id = p_drawer_session_id AND shop_id = v_shop_id AND status = 'open'
        FOR UPDATE;

        IF FOUND THEN
            v_next_cash_returns := ROUND((v_drawer.cash_returns + p_refund_amount)::numeric, 2);
            v_next_expected := ROUND((
                v_drawer.opening_cash + v_drawer.cash_sales + v_drawer.cash_customer_debt_payments
                - (v_drawer.cash_expenses + v_drawer.cash_supplier_payments + v_next_cash_returns + v_drawer.cash_withdrawals)
            )::numeric, 2);

            UPDATE public.drawer_sessions
            SET cash_returns = v_next_cash_returns,
                expected_cash = v_next_expected
            WHERE id = p_drawer_session_id AND shop_id = v_shop_id;
        END IF;
    END IF;

    INSERT INTO public.audit_logs (
        shop_id, table_name, record_id, action, new_data, changed_by, actor_name, actor_role
    ) VALUES (
        v_shop_id, 'sales_returns', v_return_id, 'RETURN',
        jsonb_build_object(
            'details',
            format('مرتجع %s (%s قطعة) من فاتورة %s بقيمة %s ج.م', v_item.product_name, p_quantity, v_invoice.invoice_number, p_refund_amount)
        ),
        v_user_id, COALESCE(v_user_name, 'المستخدم'), v_user_role
    );

    RETURN jsonb_build_object(
        'return_id', v_return_id,
        'return_number', v_return_number,
        'invoice_status', v_next_status,
        'new_returned_quantity', v_new_returned,
        'created_by_name', COALESCE(v_user_name, 'المستخدم')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. دوال الحد من محاولات الدخول الفاشلة (Rate Limiting in Postgres)
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_email TEXT, p_ip TEXT DEFAULT 'unknown')
RETURNS JSONB AS $$
DECLARE
    v_rec RECORD;
    v_key TEXT := lower(trim(COALESCE(p_email, '')));
    v_ip TEXT := COALESCE(NULLIF(trim(p_ip), ''), 'unknown');
BEGIN
    SELECT * INTO v_rec
    FROM public.login_attempts
    WHERE email = v_key AND ip_address = v_ip
    LIMIT 1;

    IF FOUND AND v_rec.locked_until IS NOT NULL AND v_rec.locked_until > now() THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'locked_until', v_rec.locked_until,
            'remaining_seconds', CEIL(EXTRACT(EPOCH FROM (v_rec.locked_until - now())))
        );
    END IF;

    RETURN jsonb_build_object('allowed', true, 'remaining_seconds', 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_failed_login(p_email TEXT, p_ip TEXT DEFAULT 'unknown')
RETURNS JSONB AS $$
DECLARE
    v_rec RECORD;
    v_key TEXT := lower(trim(COALESCE(p_email, '')));
    v_ip TEXT := COALESCE(NULLIF(trim(p_ip), ''), 'unknown');
    v_count INTEGER;
    v_locked TIMESTAMPTZ := NULL;
BEGIN
    SELECT * INTO v_rec
    FROM public.login_attempts
    WHERE email = v_key AND ip_address = v_ip
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.login_attempts (email, ip_address, attempt_count, first_attempt_at, updated_at)
        VALUES (v_key, v_ip, 1, now(), now());
        v_count := 1;
    ELSE
        IF v_rec.first_attempt_at < now() - INTERVAL '15 minutes' THEN
            v_count := 1;
            UPDATE public.login_attempts
            SET attempt_count = 1, first_attempt_at = now(), locked_until = NULL, updated_at = now()
            WHERE id = v_rec.id;
        ELSE
            v_count := v_rec.attempt_count + 1;
            IF v_count >= 5 THEN
                v_locked := now() + INTERVAL '15 minutes';
            END IF;
            UPDATE public.login_attempts
            SET attempt_count = v_count, locked_until = v_locked, updated_at = now()
            WHERE id = v_rec.id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'attempt_count', v_count,
        'locked', v_locked IS NOT NULL,
        'locked_until', v_locked
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.clear_login_rate_limit(p_email TEXT, p_ip TEXT DEFAULT 'unknown')
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.login_attempts
    WHERE email = lower(trim(COALESCE(p_email, '')))
      AND ip_address = COALESCE(NULLIF(trim(p_ip), ''), 'unknown');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_login_rate_limit(TEXT, TEXT) TO anon, authenticated;

-- 9. صلاحيات الجداول وسياسات RLS الصارمة حسب الصلاحية (RBAC Enforcement at DB Level)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles, public.role_permissions, public.user_permission_overrides, public.user_invitations TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- سياسات جداول RBAC
DROP POLICY IF EXISTS "Shop members view roles" ON public.roles;
CREATE POLICY "Shop members view roles" ON public.roles FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id());

DROP POLICY IF EXISTS "Admin manages roles" ON public.roles;
CREATE POLICY "Admin manages roles" ON public.roles FOR ALL TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'))
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'));

DROP POLICY IF EXISTS "Shop members view relevant role permissions" ON public.role_permissions;
CREATE POLICY "Shop members view relevant role permissions" ON public.role_permissions FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (role_key = public.get_current_user_role() OR public.has_permission('users.manage')));

DROP POLICY IF EXISTS "Admin manages role permissions" ON public.role_permissions;
CREATE POLICY "Admin manages role permissions" ON public.role_permissions FOR ALL TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'))
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'));

DROP POLICY IF EXISTS "Users view own permission overrides or admin" ON public.user_permission_overrides;
CREATE POLICY "Users view own permission overrides or admin" ON public.user_permission_overrides FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (user_id = auth.uid() OR public.has_permission('users.manage')));

DROP POLICY IF EXISTS "Admin manages permission overrides" ON public.user_permission_overrides;
CREATE POLICY "Admin manages permission overrides" ON public.user_permission_overrides FOR ALL TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'))
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'));

DROP POLICY IF EXISTS "Admin manages user invitations" ON public.user_invitations;
CREATE POLICY "Admin manages user invitations" ON public.user_invitations FOR ALL TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'))
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'));

-- تحديث سياسات profiles
DROP POLICY IF EXISTS "Users can view own profile or shop profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or shop profiles" ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR shop_id = public.get_current_user_shop_id());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin or self updates profile" ON public.profiles;
CREATE POLICY "Admin or self updates profile" ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid() OR (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage')))
    WITH CHECK (id = auth.uid() OR (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage')));

DROP POLICY IF EXISTS "Admin deletes profile" ON public.profiles;
CREATE POLICY "Admin deletes profile" ON public.profiles FOR DELETE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND public.has_permission('users.manage'));

-- سياسات shops
DROP POLICY IF EXISTS "Users can only access their own shop" ON public.shops;
DROP POLICY IF EXISTS "Shop select policy" ON public.shops;
CREATE POLICY "Shop select policy" ON public.shops FOR SELECT TO authenticated
    USING (id = public.get_current_user_shop_id());

DROP POLICY IF EXISTS "Admin updates shop settings" ON public.shops;
CREATE POLICY "Admin updates shop settings" ON public.shops FOR UPDATE TO authenticated
    USING (id = public.get_current_user_shop_id() AND public.has_permission('settings.manage'))
    WITH CHECK (id = public.get_current_user_shop_id() AND public.has_permission('settings.manage'));

-- سياسات products
DROP POLICY IF EXISTS "Shop isolation policy on products" ON public.products;
CREATE POLICY "RBAC select products" ON public.products FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('products.view') OR public.has_permission('pos.view') OR
        public.has_permission('inventory.view') OR public.has_permission('reports.view') OR
        public.has_permission('suppliers.manage') OR public.has_permission('dashboard.view')
    ));
CREATE POLICY "RBAC insert products" ON public.products FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('products.create') OR public.has_permission('suppliers.manage') OR public.has_permission('import.execute')
    ));
CREATE POLICY "RBAC update products" ON public.products FOR UPDATE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('products.edit') OR public.has_permission('pos.create') OR
        public.has_permission('sales.process_return') OR public.has_permission('suppliers.manage') OR
        public.has_permission('inventory.manage') OR public.has_permission('import.execute')
    ))
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('products.edit') OR public.has_permission('pos.create') OR
        public.has_permission('sales.process_return') OR public.has_permission('suppliers.manage') OR
        public.has_permission('inventory.manage') OR public.has_permission('import.execute')
    ));
CREATE POLICY "RBAC delete products" ON public.products FOR DELETE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND public.has_permission('products.delete'));

-- سياسات sales_invoices & sales_invoice_items (الكاشير يرى فواتيره فقط)
DROP POLICY IF EXISTS "Shop isolation policy on sales_invoices" ON public.sales_invoices;
CREATE POLICY "RBAC select sales_invoices" ON public.sales_invoices FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('sales.view_all') OR
        public.has_permission('reports.view') OR
        public.has_permission('dashboard.view') OR
        (public.has_permission('sales.view') AND created_by = auth.uid())
    ));
CREATE POLICY "RBAC insert sales_invoices" ON public.sales_invoices FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('pos.create'));
CREATE POLICY "RBAC update sales_invoices" ON public.sales_invoices FOR UPDATE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('sales.process_return') OR public.has_permission('sales.view_all')))
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND (public.has_permission('sales.process_return') OR public.has_permission('sales.view_all')));

DROP POLICY IF EXISTS "Shop isolation policy on sales_invoice_items" ON public.sales_invoice_items;
CREATE POLICY "RBAC select sales_invoice_items" ON public.sales_invoice_items FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('sales.view_all') OR
        public.has_permission('reports.view') OR
        public.has_permission('dashboard.view') OR
        (public.has_permission('sales.view') AND EXISTS (
            SELECT 1 FROM public.sales_invoices si WHERE si.id = invoice_id AND si.created_by = auth.uid()
        ))
    ));
CREATE POLICY "RBAC insert sales_invoice_items" ON public.sales_invoice_items FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('pos.create'));
CREATE POLICY "RBAC update sales_invoice_items" ON public.sales_invoice_items FOR UPDATE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('sales.process_return') OR public.has_permission('sales.view_all')));

-- سياسات sales_returns & sales_return_items
DROP POLICY IF EXISTS "Shop isolation policy on sales_returns" ON public.sales_returns;
CREATE POLICY "RBAC select sales_returns" ON public.sales_returns FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('sales.view_all') OR public.has_permission('reports.view') OR
        (public.has_permission('sales.view') AND created_by = auth.uid())
    ));
CREATE POLICY "RBAC insert sales_returns" ON public.sales_returns FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('sales.process_return'));

DROP POLICY IF EXISTS "Shop isolation policy on sales_return_items" ON public.sales_return_items;
CREATE POLICY "RBAC select sales_return_items" ON public.sales_return_items FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('sales.view_all') OR public.has_permission('reports.view') OR
        (public.has_permission('sales.view') AND EXISTS (
            SELECT 1 FROM public.sales_returns sr WHERE sr.id = return_id AND sr.created_by = auth.uid()
        ))
    ));
CREATE POLICY "RBAC insert sales_return_items" ON public.sales_return_items FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('sales.process_return'));

-- سياسات customers & customer_transactions
DROP POLICY IF EXISTS "Shop isolation policy on customers" ON public.customers;
CREATE POLICY "RBAC select customers" ON public.customers FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('customers.view') OR public.has_permission('pos.view') OR
        public.has_permission('reports.view') OR public.has_permission('dashboard.view')
    ));
CREATE POLICY "RBAC insert customers" ON public.customers FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('customers.create') OR public.has_permission('import.execute')
    ));
CREATE POLICY "RBAC update customers" ON public.customers FOR UPDATE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('customers.edit') OR public.has_permission('customers.collect_payment') OR
        public.has_permission('pos.create') OR public.has_permission('sales.process_return')
    ));

DROP POLICY IF EXISTS "Shop isolation policy on customer_transactions" ON public.customer_transactions;
CREATE POLICY "RBAC select customer_transactions" ON public.customer_transactions FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('customers.view') OR public.has_permission('reports.view')
    ));
CREATE POLICY "RBAC insert customer_transactions" ON public.customer_transactions FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('customers.collect_payment') OR public.has_permission('pos.create') OR public.has_permission('sales.process_return')
    ));

-- سياسات suppliers, supplier_transactions, supplier_payments, purchase_invoices, purchase_invoice_items
DROP POLICY IF EXISTS "Shop isolation policy on suppliers" ON public.suppliers;
CREATE POLICY "RBAC select suppliers" ON public.suppliers FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('suppliers.view') OR public.has_permission('reports.view') OR public.has_permission('dashboard.view')
    ));
CREATE POLICY "RBAC modify suppliers" ON public.suppliers FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND (public.has_permission('suppliers.manage') OR public.has_permission('import.execute')));
CREATE POLICY "RBAC update suppliers" ON public.suppliers FOR UPDATE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('suppliers.manage') OR public.has_permission('import.execute')));

DROP POLICY IF EXISTS "Shop isolation policy on supplier_transactions" ON public.supplier_transactions;
CREATE POLICY "RBAC select supplier_transactions" ON public.supplier_transactions FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('suppliers.view') OR public.has_permission('reports.view')));
CREATE POLICY "RBAC insert supplier_transactions" ON public.supplier_transactions FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('suppliers.manage'));

DROP POLICY IF EXISTS "Shop isolation policy on supplier_payments" ON public.supplier_payments;
CREATE POLICY "RBAC select supplier_payments" ON public.supplier_payments FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('suppliers.view') OR public.has_permission('reports.view')));
CREATE POLICY "RBAC insert supplier_payments" ON public.supplier_payments FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('suppliers.manage'));

DROP POLICY IF EXISTS "Shop isolation policy on purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "RBAC select purchase_invoices" ON public.purchase_invoices FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('suppliers.view') OR public.has_permission('reports.view')));
CREATE POLICY "RBAC insert purchase_invoices" ON public.purchase_invoices FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('suppliers.manage'));

DROP POLICY IF EXISTS "Shop isolation policy on purchase_invoice_items" ON public.purchase_invoice_items;
CREATE POLICY "RBAC select purchase_invoice_items" ON public.purchase_invoice_items FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('suppliers.view') OR public.has_permission('reports.view')));
CREATE POLICY "RBAC insert purchase_invoice_items" ON public.purchase_invoice_items FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('suppliers.manage'));

-- سياسات expenses
DROP POLICY IF EXISTS "Shop isolation policy on expenses" ON public.expenses;
CREATE POLICY "RBAC select expenses" ON public.expenses FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('expenses.view') OR public.has_permission('reports.view') OR public.has_permission('dashboard.view')
    ));
CREATE POLICY "RBAC insert expenses" ON public.expenses FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND (public.has_permission('expenses.create') OR public.has_permission('import.execute')));

-- سياسات damaged_items, physical_inventory_counts, physical_inventory_items
DROP POLICY IF EXISTS "Shop isolation policy on damaged_items" ON public.damaged_items;
CREATE POLICY "RBAC select damaged_items" ON public.damaged_items FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('inventory.view') OR public.has_permission('reports.view')));
CREATE POLICY "RBAC insert damaged_items" ON public.damaged_items FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND (public.has_permission('inventory.manage') OR public.has_permission('sales.process_return')));

DROP POLICY IF EXISTS "Shop isolation policy on physical_inventory_counts" ON public.physical_inventory_counts;
CREATE POLICY "RBAC select inventory_counts" ON public.physical_inventory_counts FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('inventory.view') OR public.has_permission('reports.view')));
CREATE POLICY "RBAC insert inventory_counts" ON public.physical_inventory_counts FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('inventory.manage'));
CREATE POLICY "RBAC update inventory_counts" ON public.physical_inventory_counts FOR UPDATE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND public.has_permission('inventory.manage'));

DROP POLICY IF EXISTS "Shop isolation policy on physical_inventory_items" ON public.physical_inventory_items;
CREATE POLICY "RBAC select inventory_items" ON public.physical_inventory_items FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('inventory.view') OR public.has_permission('reports.view')));
CREATE POLICY "RBAC insert inventory_items" ON public.physical_inventory_items FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('inventory.manage'));

-- سياسات drawer_sessions
DROP POLICY IF EXISTS "Shop isolation policy on drawer_sessions" ON public.drawer_sessions;
CREATE POLICY "RBAC select drawer_sessions" ON public.drawer_sessions FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('drawer.view') OR public.has_permission('pos.view') OR
        public.has_permission('expenses.create') OR public.has_permission('suppliers.manage') OR
        public.has_permission('dashboard.view') OR public.has_permission('reports.view')
    ));
CREATE POLICY "RBAC insert drawer_sessions" ON public.drawer_sessions FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('drawer.open_close'));
CREATE POLICY "RBAC update drawer_sessions" ON public.drawer_sessions FOR UPDATE TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (
        public.has_permission('drawer.open_close') OR public.has_permission('drawer.reopen') OR
        public.has_permission('pos.create') OR public.has_permission('sales.process_return') OR
        public.has_permission('expenses.create') OR public.has_permission('suppliers.manage') OR
        public.has_permission('customers.collect_payment') OR public.has_permission('withdrawals.create')
    ));

-- سياسات owner_withdrawals
DROP POLICY IF EXISTS "Shop isolation policy on owner_withdrawals" ON public.owner_withdrawals;
CREATE POLICY "RBAC select owner_withdrawals" ON public.owner_withdrawals FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('withdrawals.view') OR public.has_permission('reports.view')));
CREATE POLICY "RBAC insert owner_withdrawals" ON public.owner_withdrawals FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() AND public.has_permission('withdrawals.create'));

-- سياسات audit_logs
DROP POLICY IF EXISTS "Shop isolation policy on audit_logs" ON public.audit_logs;
CREATE POLICY "RBAC select audit_logs" ON public.audit_logs FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() AND (public.has_permission('audit.view') OR public.has_permission('users.manage')));
CREATE POLICY "RBAC insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id());
