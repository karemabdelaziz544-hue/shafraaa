-- ============================================================================
-- سكربت إنشاء حساب المعاينة التجريبي وبيانات المتجر التجريبي المنفصل
-- Demo User: demo@shafra.com / DemoShafra2026!
-- معزول تماماً في متجر مستقل (shop_id مختلف) ولا يكشف بيانات المحل الحقيقي
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_demo_email TEXT := 'demo@shafra.com';
    v_demo_password TEXT := 'DemoShafra2026!';
    v_demo_user_id UUID;
    v_demo_shop_id UUID := '00000000-0000-4000-8000-00000000de01';
    v_drawer_id UUID := '00000000-0000-4000-8000-00000000de10';
    v_prod_1 UUID := '00000000-0000-4000-8000-00000000de21';
    v_prod_2 UUID := '00000000-0000-4000-8000-00000000de22';
    v_prod_3 UUID := '00000000-0000-4000-8000-00000000de23';
    v_prod_4 UUID := '00000000-0000-4000-8000-00000000de24';
    v_prod_5 UUID := '00000000-0000-4000-8000-00000000de25';
    v_cust_1 UUID := '00000000-0000-4000-8000-00000000de31';
    v_cust_2 UUID := '00000000-0000-4000-8000-00000000de32';
    v_cust_3 UUID := '00000000-0000-4000-8000-00000000de33';
    v_supp_1 UUID := '00000000-0000-4000-8000-00000000de41';
    v_supp_2 UUID := '00000000-0000-4000-8000-00000000de42';
    v_sale_1 UUID := '00000000-0000-4000-8000-00000000de51';
    v_sale_2 UUID := '00000000-0000-4000-8000-00000000de52';
    v_pur_1  UUID := '00000000-0000-4000-8000-00000000de61';
BEGIN
    -- 1. إنشاء المتجر التجريبي المنفصل أولاً
    INSERT INTO public.shops (id, name, owner_name, phone, address, currency)
    VALUES (
        v_demo_shop_id,
        'متجر تجريبي (نسخة عرض)',
        'مراجع تجريبي',
        '01000000000',
        'القاهرة - نسخة معاينة',
        'EGP'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. البحث عن المستخدم التجريبي أو إنشاؤه في auth.users
    SELECT id INTO v_demo_user_id FROM auth.users WHERE email = v_demo_email LIMIT 1;

    IF v_demo_user_id IS NULL THEN
        v_demo_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_demo_user_id,
            'authenticated',
            'authenticated',
            v_demo_email,
            crypt(v_demo_password, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"مراجع تجريبي","role":"owner","shop_name":"متجر تجريبي (نسخة عرض)"}',
            now(),
            now(),
            '',
            '',
            '',
            ''
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_demo_user_id,
            jsonb_build_object('sub', v_demo_user_id::text, 'email', v_demo_email),
            'email',
            v_demo_user_id::text,
            now(),
            now(),
            now()
        );
    END IF;

    -- 3. ربط المستخدم التجريبي بالمتجر التجريبي فقط
    INSERT INTO public.profiles (id, shop_id, full_name, role, is_active)
    VALUES (v_demo_user_id, v_demo_shop_id, 'مراجع تجريبي', 'owner', true)
    ON CONFLICT (id) DO UPDATE SET shop_id = v_demo_shop_id, full_name = 'مراجع تجريبي', role = 'owner';

    -- 4. بذر منتجات تجريبية وهمية
    INSERT INTO public.products (id, shop_id, name, barcode, category_name, cost_price, extra_cost, sale_price, opening_stock, current_stock, min_stock_alert, unit)
    VALUES
        (v_prod_1, v_demo_shop_id, 'ريموت سيارة تويوتا (تجريبي)', '6229001001', 'ريموتات', 250.00, 10.00, 450.00, 20, 18, 5, 'قطعة'),
        (v_prod_2, v_demo_shop_id, 'مفتاح سيارة مع برمجة (تجريبي)', '6229001002', 'مفاتيح مبرمجة', 300.00, 20.00, 600.00, 15, 14, 4, 'قطعة'),
        (v_prod_3, v_demo_shop_id, 'بطارية ريموت CR2032 (تجريبي)', '6229001003', 'بطاريات', 15.00, 0.00, 45.00, 50, 47, 10, 'قطعة'),
        (v_prod_4, v_demo_shop_id, 'جراب سيليكون مفتاح (تجريبي)', '6229001004', 'إكسسوارات', 20.00, 0.00, 60.00, 10, 3, 5, 'قطعة'),
        (v_prod_5, v_demo_shop_id, 'شريحة إيموبلايزر ID48 (تجريبي)', '6229001005', 'شرائح', 90.00, 5.00, 200.00, 25, 24, 5, 'قطعة')
    ON CONFLICT (id) DO NOTHING;

    -- 5. بذر عملاء تجريبيين
    INSERT INTO public.customers (id, shop_id, name, phone, credit_limit, current_balance, notes)
    VALUES
        (v_cust_1, v_demo_shop_id, 'أحمد حسن (عميل تجريبي)', '01011112222', 1500.00, 350.00, 'عميل ورشة تجريبي'),
        (v_cust_2, v_demo_shop_id, 'محمود علي (عميل تجريبي)', '01133334444', 500.00, 650.00, 'تجاوز حد الائتمان للعرض'),
        (v_cust_3, v_demo_shop_id, 'سارة خالد (عميل تجريبي)', '01255556666', 1000.00, 0.00, 'عميل نقدي منتظم')
    ON CONFLICT (id) DO NOTHING;

    -- 6. بذر موردين تجريبيين
    INSERT INTO public.suppliers (id, shop_id, name, company, phone, owed_balance, notes)
    VALUES
        (v_supp_1, v_demo_shop_id, 'شركة الأمل للتوريدات (تجريبي)', 'الأمل جروب', '01099998888', 1200.00, 'مورد ريموتات ومفاتيح'),
        (v_supp_2, v_demo_shop_id, 'مؤسسة النيل للإكسسوار (تجريبي)', 'النيل', '01277776666', 0.00, 'سداد فوري')
    ON CONFLICT (id) DO NOTHING;

    -- 7. بذر جلسة درج مفتوحة للعرض
    INSERT INTO public.drawer_sessions (id, shop_id, status, opening_cash, cash_sales, cash_returns, cash_customer_debt_payments, cash_supplier_payments, cash_expenses, cash_withdrawals, expected_cash, wallet_total, instapay_total, opened_by)
    VALUES
        (v_drawer_id, v_demo_shop_id, 'open', 1000.00, 645.00, 0.00, 0.00, 500.00, 150.00, 0.00, 995.00, 0.00, 600.00, v_demo_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- 8. بذر فواتير بيع تجريبية
    INSERT INTO public.sales_invoices (id, shop_id, invoice_number, customer_id, customer_name, subtotal, discount, total_amount, total_cost, gross_profit, paid_amount, remaining_amount, payment_method, status, drawer_session_id, created_by)
    VALUES
        (v_sale_1, v_demo_shop_id, 'DEMO-INV-0001', v_cust_3, 'سارة خالد (عميل تجريبي)', 645.00, 0.00, 645.00, 290.00, 355.00, 645.00, 0.00, 'cash', 'completed', v_drawer_id, v_demo_user_id),
        (v_sale_2, v_demo_shop_id, 'DEMO-INV-0002', v_cust_1, 'أحمد حسن (عميل تجريبي)', 950.00, 0.00, 950.00, 335.00, 615.00, 600.00, 350.00, 'instapay', 'completed', v_drawer_id, v_demo_user_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.sales_invoice_items (shop_id, invoice_id, product_id, product_name, barcode, quantity, unit_cost, unit_price, discount, line_total, line_cost, line_profit)
    SELECT v_demo_shop_id, v_sale_1, v_prod_1, 'ريموت سيارة تويوتا (تجريبي)', '6229001001', 1, 260.00, 450.00, 0, 450.00, 260.00, 190.00
    WHERE NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = v_sale_1 AND product_id = v_prod_1);

    INSERT INTO public.sales_invoice_items (shop_id, invoice_id, product_id, product_name, barcode, quantity, unit_cost, unit_price, discount, line_total, line_cost, line_profit)
    SELECT v_demo_shop_id, v_sale_1, v_prod_3, 'بطارية ريموت CR2032 (تجريبي)', '6229001003', 3, 15.00, 45.00, 0, 135.00, 45.00, 90.00
    WHERE NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = v_sale_1 AND product_id = v_prod_3);

    INSERT INTO public.sales_invoice_items (shop_id, invoice_id, product_id, product_name, barcode, quantity, unit_cost, unit_price, discount, line_total, line_cost, line_profit)
    SELECT v_demo_shop_id, v_sale_1, v_prod_4, 'جراب سيليكون مفتاح (تجريبي)', '6229001004', 1, 20.00, 60.00, 0, 60.00, 20.00, 40.00
    WHERE NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = v_sale_1 AND product_id = v_prod_4);

    INSERT INTO public.sales_invoice_items (shop_id, invoice_id, product_id, product_name, barcode, quantity, unit_cost, unit_price, discount, line_total, line_cost, line_profit)
    SELECT v_demo_shop_id, v_sale_2, v_prod_2, 'مفتاح سيارة مع برمجة (تجريبي)', '6229001002', 1, 320.00, 600.00, 0, 600.00, 320.00, 280.00
    WHERE NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = v_sale_2 AND product_id = v_prod_2);

    -- 9. بذر فاتورة توريد تجريبية وسداد مورد
    INSERT INTO public.purchase_invoices (id, shop_id, invoice_number, supplier_id, supplier_name, total_amount, paid_amount, remaining_amount, payment_method, drawer_session_id, notes, created_by)
    VALUES
        (v_pur_1, v_demo_shop_id, 'DEMO-PUR-0001', v_supp_1, 'شركة الأمل للتوريدات (تجريبي)', 1700.00, 500.00, 1200.00, 'cash', v_drawer_id, 'فاتورة توريد تجريبية للعرض', v_demo_user_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.purchase_invoice_items (shop_id, purchase_id, product_id, product_name, quantity, unit_cost, line_total)
    SELECT v_demo_shop_id, v_pur_1, v_prod_1, 'ريموت سيارة تويوتا (تجريبي)', 5, 250.00, 1250.00
    WHERE NOT EXISTS (SELECT 1 FROM public.purchase_invoice_items WHERE purchase_id = v_pur_1 AND product_id = v_prod_1);

    INSERT INTO public.supplier_payments (shop_id, supplier_id, amount, payment_method, payment_date, notes, drawer_session_id, created_by)
    SELECT v_demo_shop_id, v_supp_1, 500.00, 'cash', CURRENT_DATE, 'دفعة مقدمة مع فاتورة DEMO-PUR-0001', v_drawer_id, v_demo_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.supplier_payments WHERE shop_id = v_demo_shop_id AND supplier_id = v_supp_1);

    -- 10. بذر مصروفات وهالك تجريبي
    INSERT INTO public.expenses (shop_id, type, category, amount, payment_method, expense_date, drawer_session_id, notes, created_by)
    SELECT v_demo_shop_id, 'variable', 'شحن وتغليف', 150.00, 'cash', CURRENT_DATE, v_drawer_id, 'مصروف تجريبي للمعاينة', v_demo_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.expenses WHERE shop_id = v_demo_shop_id AND category = 'شحن وتغليف');

    INSERT INTO public.damaged_items (shop_id, product_id, product_name, quantity, unit_cost, total_loss, reason, notes, damage_date, created_by)
    SELECT v_demo_shop_id, v_prod_5, 'شريحة إيموبلايزر ID48 (تجريبي)', 1, 95.00, 95.00, 'تلف أثناء التجربة (بيان عرض)', 'بند هالك تجريبي', CURRENT_DATE, v_demo_user_id
    WHERE NOT EXISTS (SELECT 1 FROM public.damaged_items WHERE shop_id = v_demo_shop_id AND product_id = v_prod_5);
END $$;
