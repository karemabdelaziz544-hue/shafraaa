-- Migration 7: Block Public Sign-ups, Fast Single-Roundtrip Login/Middleware RPCs, and Admin-Only Shop Name Editing

-- 1. منع التسجيل العام نهائياً في قاعدة البيانات (لا يُسمح بإنشاء حساب إلا بدعوة مسجلة من مدير النظام)
CREATE OR REPLACE FUNCTION public.handle_new_user_shop_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_invite RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;

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

    RAISE EXCEPTION 'التسجيل العام معطّل. لا يمكن إنشاء حساب إلا بواسطة مدير النظام.'
        USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. تقييد تعديل اسم المحل على مدير النظام (Admin) فقط
CREATE OR REPLACE FUNCTION public.protect_shop_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NEW.name IS DISTINCT FROM OLD.name THEN
        IF public.get_current_user_role() <> 'admin' THEN
            RAISE EXCEPTION 'تعديل اسم المحل متاح لمدير النظام (Admin) فقط.'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_shop_admin_fields ON public.shops;
CREATE TRIGGER trg_protect_shop_admin_fields
    BEFORE UPDATE ON public.shops
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_shop_admin_fields();

DROP POLICY IF EXISTS "Admin updates shop settings" ON public.shops;
CREATE POLICY "Admin updates shop settings" ON public.shops FOR UPDATE TO authenticated
    USING (
        id = public.get_current_user_shop_id()
        AND (public.get_current_user_role() = 'admin' OR public.has_permission('settings.manage'))
    )
    WITH CHECK (
        id = public.get_current_user_shop_id()
        AND (public.get_current_user_role() = 'admin' OR public.has_permission('settings.manage'))
    );

-- 3. دالة عامة آمنة لقراءة اسم المحل لصفحة تسجيل الدخول دون كشف أي بيانات حساسة
CREATE OR REPLACE FUNCTION public.get_public_shop_name()
RETURNS TEXT AS $$
    SELECT name FROM public.shops ORDER BY created_at ASC LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_public_shop_name() TO anon, authenticated;

-- 4. دالة سريعة لإنهاء تسجيل الدخول في استعلام واحد (التحقق من الملف + مسح محاولات الفشل + تسجيل الدخول + إرجاع الصلاحيات واسم المحل)
CREATE OR REPLACE FUNCTION public.finalize_user_login(p_email TEXT, p_ip TEXT DEFAULT 'unknown')
RETURNS JSONB AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_prof RECORD;
    v_role TEXT;
    v_role_perms JSONB := '{}'::jsonb;
    v_overrides JSONB := '{}'::jsonb;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'UNAUTHENTICATED');
    END IF;

    SELECT
        p.id,
        p.shop_id,
        p.full_name,
        p.role,
        p.is_active,
        s.name AS shop_name,
        s.owner_name,
        s.session_timeout_minutes
    INTO v_prof
    FROM public.profiles p
    JOIN public.shops s ON s.id = p.shop_id
    WHERE p.id = v_uid
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'NO_PROFILE');
    END IF;

    IF v_prof.is_active = false THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'DEACTIVATED');
    END IF;

    v_role := CASE WHEN v_prof.role = 'owner' THEN 'admin' ELSE v_prof.role END;

    UPDATE public.profiles
    SET last_login_at = now(), last_seen_at = now()
    WHERE id = v_uid;

    DELETE FROM public.login_attempts
    WHERE email = lower(trim(p_email))
      AND ip_address = COALESCE(NULLIF(trim(p_ip), ''), 'unknown');

    INSERT INTO public.audit_logs (
        shop_id, table_name, record_id, action, changed_by, actor_name, actor_role, new_data
    ) VALUES (
        v_prof.shop_id,
        'auth',
        v_uid,
        'LOGIN',
        v_uid,
        v_prof.full_name,
        v_role,
        jsonb_build_object('details', 'تسجيل دخول ناجح للمستخدم: ' || v_prof.full_name || ' (' || lower(trim(p_email)) || ')')
    );

    IF v_role <> 'admin' THEN
        SELECT COALESCE(jsonb_object_agg(permission_key, allowed), '{}'::jsonb)
        INTO v_role_perms
        FROM public.role_permissions
        WHERE shop_id = v_prof.shop_id AND role_key = v_role;

        SELECT COALESCE(jsonb_object_agg(permission_key, allowed), '{}'::jsonb)
        INTO v_overrides
        FROM public.user_permission_overrides
        WHERE shop_id = v_prof.shop_id AND user_id = v_uid;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'shopId', v_prof.shop_id,
        'shopName', v_prof.shop_name,
        'ownerName', v_prof.owner_name,
        'fullName', v_prof.full_name,
        'role', v_role,
        'sessionTimeoutMinutes', COALESCE(v_prof.session_timeout_minutes, 120),
        'rolePermissions', v_role_perms,
        'userOverrides', v_overrides
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.finalize_user_login(TEXT, TEXT) TO authenticated;

-- 5. دالة سريعة للـ Middleware (جولة واحدة بدلاً من 3 استعلامات متتالية)
CREATE OR REPLACE FUNCTION public.get_middleware_auth_context()
RETURNS JSONB AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_prof RECORD;
    v_role TEXT;
    v_role_perms JSONB := '{}'::jsonb;
    v_overrides JSONB := '{}'::jsonb;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    SELECT shop_id, role, is_active
    INTO v_prof
    FROM public.profiles
    WHERE id = v_uid
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    v_role := CASE WHEN v_prof.role = 'owner' THEN 'admin' ELSE v_prof.role END;

    IF v_prof.is_active AND v_role <> 'admin' THEN
        SELECT COALESCE(jsonb_object_agg(permission_key, allowed), '{}'::jsonb)
        INTO v_role_perms
        FROM public.role_permissions
        WHERE shop_id = v_prof.shop_id AND role_key = v_role;

        SELECT COALESCE(jsonb_object_agg(permission_key, allowed), '{}'::jsonb)
        INTO v_overrides
        FROM public.user_permission_overrides
        WHERE shop_id = v_prof.shop_id AND user_id = v_uid;
    END IF;

    RETURN jsonb_build_object(
        'found', true,
        'shopId', v_prof.shop_id,
        'role', v_role,
        'isActive', COALESCE(v_prof.is_active, false),
        'rolePermissions', v_role_perms,
        'userOverrides', v_overrides
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_middleware_auth_context() TO authenticated;
