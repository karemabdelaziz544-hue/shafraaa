-- Migration 5: Fix PostgreSQL table GRANTs (42501), RLS on profiles (403), and server-side Return RPC
-- محل شفرة - المالك: كريم

-- 1. إصلاح صلاحيات الجداول والتسلسلات لدور authenticated (يحل خطأ 42501 permission denied)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- 2. تحديث دالة معرفة متجر المستخدم الحالي مع تثبيت search_path ومنح صلاحية التنفيذ
CREATE OR REPLACE FUNCTION public.get_current_user_shop_id()
RETURNS UUID AS $$
    SELECT shop_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_current_user_shop_id() TO authenticated, anon;

-- 3. إصلاح سياسات RLS لجدول profiles بحيث يستطيع المستخدم دائماً قراءة ملفه الشخصي (يحل 403)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their shop profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or shop profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or shop profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR shop_id = public.get_current_user_shop_id());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 4. التأكد من تفعيل سياسات RLS الكاملة (SELECT, INSERT, UPDATE, DELETE) لدور authenticated على كل الجداول
DO $$
DECLARE
    tbl TEXT;
    tables_list TEXT[] := ARRAY[
        'categories',
        'products',
        'price_history',
        'customers',
        'customer_transactions',
        'suppliers',
        'supplier_transactions',
        'supplier_payments',
        'drawer_sessions',
        'sales_invoices',
        'sales_invoice_items',
        'sales_returns',
        'sales_return_items',
        'purchase_invoices',
        'purchase_invoice_items',
        'damaged_items',
        'physical_inventory_counts',
        'physical_inventory_items',
        'expenses',
        'owner_withdrawals',
        'audit_logs'
    ];
BEGIN
    -- سياسة جدول shops
    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own shop" ON public.shops';
    EXECUTE 'CREATE POLICY "Users can only access their own shop" ON public.shops FOR ALL TO authenticated USING (id = public.get_current_user_shop_id()) WITH CHECK (id = public.get_current_user_shop_id())';

    FOREACH tbl IN ARRAY tables_list LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Shop isolation policy on %s" ON public.%I', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "Shop isolation policy on %s" ON public.%I FOR ALL TO authenticated USING (shop_id = public.get_current_user_shop_id()) WITH CHECK (shop_id = public.get_current_user_shop_id())',
            tbl, tbl
        );
    END LOOP;
END $$;

-- إزالة السياسات القديمة ذات الأسماء المختلفة لتجنب التضارب على supplier_payments و damaged_items
DROP POLICY IF EXISTS "Users can view their shop's supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Users can insert their shop's supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Users can view their shop's damaged items" ON public.damaged_items;
DROP POLICY IF EXISTS "Users can insert their shop's damaged items" ON public.damaged_items;
DROP POLICY IF EXISTS "Users can only access their shop damaged items" ON public.damaged_items;

-- 5. ربط أي مستخدم موجود في auth.users بدون ملف شخصي بمتجر خاص به تلقائياً (Safety Backfill)
DO $$
DECLARE
    u RECORD;
    v_new_shop_id UUID;
    v_name TEXT;
BEGIN
    FOR u IN
        SELECT id, email, raw_user_meta_data
        FROM auth.users au
        WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
    LOOP
        v_name := COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'المالك');
        INSERT INTO public.shops (name, owner_name)
        VALUES (
            COALESCE(u.raw_user_meta_data->>'shop_name', 'محل ' || v_name),
            v_name
        )
        RETURNING id INTO v_new_shop_id;

        INSERT INTO public.profiles (id, shop_id, full_name, role, is_active)
        VALUES (u.id, v_new_shop_id, v_name, 'owner', true);
    END LOOP;
END $$;

-- 6. تحديث جداول المرتجعات لدعم التتبع الدقيق والتحقق من الخادم
ALTER TABLE IF EXISTS public.sales_returns
ADD COLUMN IF NOT EXISTS created_by_name TEXT;

ALTER TABLE IF EXISTS public.sales_returns
DROP CONSTRAINT IF EXISTS sales_returns_refund_method_check;

ALTER TABLE IF EXISTS public.sales_returns
ADD CONSTRAINT sales_returns_refund_method_check
CHECK (refund_method IN ('cash', 'wallet', 'instapay', 'credit', 'credit_balance'));

ALTER TABLE IF EXISTS public.sales_invoice_items
ADD COLUMN IF NOT EXISTS returned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE IF EXISTS public.sales_return_items
ADD COLUMN IF NOT EXISTS line_refund_total NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- 7. دالة معالجة المرتجع الآمنة على الخادم (Server-Side Return Validation RPC)
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

    SELECT shop_id, full_name INTO v_shop_id, v_user_name
    FROM public.profiles
    WHERE id = v_user_id
    LIMIT 1;

    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مرتبط بمتجر';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'يجب أن تكون الكمية المرتجعة أكبر من صفر';
    END IF;

    -- قفل سطر الفاتورة وبند الفاتورة لمنع تكرار المرتجع المتزامن
    SELECT * INTO v_invoice
    FROM public.sales_invoices
    WHERE id = p_invoice_id AND shop_id = v_shop_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الفاتورة غير موجودة';
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

    -- 1. تسجيل رأس وتفاصيل المرتجع
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

    -- 2. تحديث الكمية المرتجعة على بند الفاتورة الأصلي
    UPDATE public.sales_invoice_items
    SET returned_quantity = v_new_returned
    WHERE id = p_invoice_item_id AND shop_id = v_shop_id;

    -- 3. حساب حالة الفاتورة الكلية (مكتملة / مرتجع جزئي / مرتجع بالكامل)
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

    -- 4. تحديث الفاتورة ومديونية العميل إن كان الرد خصماً من الدين
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

    -- 5. تحديث المخزون أو تسجيل هالك
    IF p_is_sellable AND v_item.product_id IS NOT NULL THEN
        UPDATE public.products
        SET current_stock = ROUND((current_stock + p_quantity)::numeric, 2),
            updated_at = now()
        WHERE id = v_item.product_id AND shop_id = v_shop_id;
    ELSIF NOT p_is_sellable THEN
        INSERT INTO public.damaged_items (
            shop_id, product_id, product_name, quantity, unit_cost, total_loss, reason, notes, damage_date, created_by
        ) VALUES (
            v_shop_id, v_item.product_id, v_item.product_name,
            ROUND(p_quantity::numeric, 2), v_item.unit_cost,
            ROUND((p_quantity * v_item.unit_cost)::numeric, 2),
            'مرتجع تالف من فاتورة #' || v_invoice.invoice_number,
            p_reason, CURRENT_DATE, v_user_id
        );
    END IF;

    -- 6. تحديث الدرج إذا كان الرد كاش
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

    -- 7. سجل التدقيق
    INSERT INTO public.audit_logs (
        shop_id, table_name, record_id, action, new_data, changed_by
    ) VALUES (
        v_shop_id, 'sales_returns', v_return_id, 'RETURN',
        jsonb_build_object(
            'details',
            format('مرتجع %s (%s قطعة) من فاتورة %s بقيمة %s ج.م', v_item.product_name, p_quantity, v_invoice.invoice_number, p_refund_amount)
        ),
        v_user_id
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

GRANT EXECUTE ON FUNCTION public.process_sale_return(UUID, UUID, NUMERIC, NUMERIC, TEXT, BOOLEAN, TEXT, UUID) TO authenticated;
