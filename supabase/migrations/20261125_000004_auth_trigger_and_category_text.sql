-- Migration 4: Add category_name to products and automatic shop/profile trigger on signup
-- محل شفرة - المالك: كريم

-- 1. إضافة عمود اسم التصنيف النصي للمنتجات لتسهيل المزامنة المباشرة
ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS category_name TEXT NOT NULL DEFAULT 'عام';

-- 2. دالة وتريجر لإنشاء محل وملف شخصي تلقائياً عند تسجيل مستخدم جديد من صفحة الدخول
CREATE OR REPLACE FUNCTION public.handle_new_user_shop_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_shop_id UUID;
    v_full_name TEXT;
    v_role TEXT;
BEGIN
    -- تخطي الإنشاء إذا كان للمستخدم ملف شخصي مسبقاً (مثلاً عند البذر اليدوي)
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;

    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'المالك');
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'owner');
    IF v_role NOT IN ('owner', 'cashier', 'accountant') THEN
        v_role := 'owner';
    END IF;

    -- إنشاء محل جديد معزول للمستخدم الجديد
    INSERT INTO public.shops (name, owner_name)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'shop_name', 'محل ' || v_full_name),
        v_full_name
    )
    RETURNING id INTO v_shop_id;

    INSERT INTO public.profiles (id, shop_id, full_name, role, is_active)
    VALUES (NEW.id, v_shop_id, v_full_name, v_role, true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_shop_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_shop_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_shop_profile();
