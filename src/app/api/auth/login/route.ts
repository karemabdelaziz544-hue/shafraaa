import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getClientIp } from '@/lib/supabase/server';
import { globalLoginRateLimiter } from '@/lib/auth-security';
import {
  getDefaultHomeRoute,
  normalizeRoleKey,
  resolveEffectivePermissions,
  type PermissionKey,
} from '@/lib/rbac';

export async function POST(request: Request) {
  const tStart = performance.now();
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const ip = getClientIp(request);

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' },
        { status: 400 }
      );
    }

    // 1. فحص فوري في الذاكرة قبل لمس الشبكة
    const memLimit = globalLoginRateLimiter.check(email, ip);
    if (!memLimit.allowed) {
      const mins = Math.max(1, Math.ceil(memLimit.remainingSeconds / 60));
      return NextResponse.json(
        {
          ok: false,
          code: 'RATE_LIMITED',
          error: `تم حظر تسجيل الدخول مؤقتاً بسبب تكرار المحاولات الفاشلة. يرجى المحاولة بعد ${mins} دقيقة.`,
        },
        { status: 429 }
      );
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: 'إعدادات Supabase غير متوفرة' },
        { status: 503 }
      );
    }

    // 2. تشغيل فحص القاعدة وتسجيل الدخول بالتوازي لتقليل زمن الاستجابة إلى النصف
    const tAuthStart = performance.now();
    const [dbLimitRes, authRes] = await Promise.all([
      Promise.resolve(supabase.rpc('check_login_rate_limit', { p_email: email, p_ip: ip }))
        .then((r) => r.data)
        .catch(() => null),
      supabase.auth.signInWithPassword({ email, password }),
    ]);
    const tAuthMs = Math.round(performance.now() - tAuthStart);

    if (dbLimitRes && dbLimitRes.allowed === false) {
      if (authRes.data?.user) {
        await supabase.auth.signOut().catch(() => null);
      }
      const mins = Math.max(1, Math.ceil(Number(dbLimitRes.remaining_seconds || 60) / 60));
      return NextResponse.json(
        {
          ok: false,
          code: 'RATE_LIMITED',
          error: `تم حظر تسجيل الدخول مؤقتاً بسبب تكرار المحاولات الفاشلة. يرجى المحاولة بعد ${mins} دقيقة.`,
        },
        { status: 429 }
      );
    }

    const { data, error } = authRes;
    if (error || !data?.user) {
      const memRec = globalLoginRateLimiter.recordFailure(email, ip);
      await Promise.resolve(supabase.rpc('record_failed_login', { p_email: email, p_ip: ip })).catch(() => null);

      if (memRec.locked) {
        return NextResponse.json(
          {
            ok: false,
            code: 'RATE_LIMITED',
            error: 'تجاوزت الحد الأقصى لمحاولات الدخول الفاشلة (5 محاولات). تم إيقاف المحاولات لمدة 15 دقيقة.',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: `بيانات الدخول غير صحيحة (محاولة ${memRec.attempts} من 5).`,
        },
        { status: 401 }
      );
    }

    // 3. استدعاء موحد لإنهاء الدخول وجلب بيانات المتجر والصلاحيات وتحديث سجل الدخول والتدقيق
    const tFinalizeStart = performance.now();
    let bootstrap: {
      shopId: string;
      shopName: string;
      ownerName: string;
      fullName: string;
      role: ReturnType<typeof normalizeRoleKey>;
      sessionTimeoutMinutes: number;
      permissions: Record<PermissionKey, boolean>;
    } | null = null;

    const rpcRes = await Promise.resolve(
      supabase.rpc('finalize_user_login', { p_email: email, p_ip: ip })
    ).catch(() => ({ data: null, error: { message: 'RPC unavailable' } }));

    const fin = rpcRes?.data as any;

    if (fin && fin.ok === false) {
      await supabase.auth.signOut().catch(() => null);
      if (fin.reason === 'DEACTIVATED') {
        return NextResponse.json(
          { ok: false, code: 'ACCOUNT_DEACTIVATED', error: 'تم إيقاف هذا الحساب من قِبل مدير النظام ولا يمكنه الدخول.' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { ok: false, error: 'هذا الحساب غير مرتبط بمتجر بعد. تواصل مع مدير النظام.' },
        { status: 403 }
      );
    }

    if (fin && fin.ok === true) {
      const role = normalizeRoleKey(fin.role);
      const permissions = resolveEffectivePermissions({
        role,
        rolePermissions: fin.rolePermissions || {},
        userOverrides: fin.userOverrides || {},
      });
      bootstrap = {
        shopId: fin.shopId,
        shopName: fin.shopName || 'محل شفرة',
        ownerName: fin.ownerName || fin.fullName || 'كريم',
        fullName: fin.fullName || 'المستخدم',
        role,
        sessionTimeoutMinutes: Number(fin.sessionTimeoutMinutes || 120),
        permissions,
      };
    } else {
      // مسار احتياطي إذا لم يُطبّق الميجريشن السابع بعد
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('id, shop_id, full_name, role, is_active, shops(name, owner_name, session_timeout_minutes)')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profError || !profile) {
        await supabase.auth.signOut().catch(() => null);
        return NextResponse.json(
          { ok: false, error: 'هذا الحساب غير مرتبط بمتجر بعد. تواصل مع مدير النظام.' },
          { status: 403 }
        );
      }

      if (!profile.is_active) {
        await supabase.auth.signOut().catch(() => null);
        return NextResponse.json(
          { ok: false, code: 'ACCOUNT_DEACTIVATED', error: 'تم إيقاف هذا الحساب من قِبل مدير النظام ولا يمكنه الدخول.' },
          { status: 403 }
        );
      }

      const role = normalizeRoleKey(profile.role);
      const shopRow = Array.isArray(profile.shops) ? profile.shops[0] : profile.shops;
      const [rolePermsRes, overridesRes] =
        role === 'admin'
          ? [{ data: [] }, { data: [] }]
          : await Promise.all([
              supabase
                .from('role_permissions')
                .select('permission_key, allowed')
                .eq('shop_id', profile.shop_id)
                .eq('role_key', role),
              supabase
                .from('user_permission_overrides')
                .select('permission_key, allowed')
                .eq('shop_id', profile.shop_id)
                .eq('user_id', data.user.id),
            ]);

      const rolePermMap: Partial<Record<PermissionKey, boolean>> = {};
      (rolePermsRes.data || []).forEach((rp: any) => {
        rolePermMap[rp.permission_key as PermissionKey] = Boolean(rp.allowed);
      });
      const overrideMap: Partial<Record<PermissionKey, boolean>> = {};
      (overridesRes.data || []).forEach((ov: any) => {
        overrideMap[ov.permission_key as PermissionKey] = Boolean(ov.allowed);
      });

      bootstrap = {
        shopId: profile.shop_id,
        shopName: (shopRow as any)?.name || 'محل شفرة',
        ownerName: (shopRow as any)?.owner_name || profile.full_name || 'كريم',
        fullName: profile.full_name || 'المستخدم',
        role,
        sessionTimeoutMinutes: Number((shopRow as any)?.session_timeout_minutes || 120),
        permissions: resolveEffectivePermissions({
          role,
          rolePermissions: rolePermMap,
          userOverrides: overrideMap,
        }),
      };

      void Promise.allSettled([
        supabase.rpc('clear_login_rate_limit', { p_email: email, p_ip: ip }),
        supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
          .eq('id', data.user.id),
        supabase.from('audit_logs').insert({
          shop_id: profile.shop_id,
          table_name: 'auth',
          record_id: data.user.id,
          action: 'LOGIN',
          changed_by: data.user.id,
          actor_name: profile.full_name,
          actor_role: role,
          new_data: { details: `تسجيل دخول ناجح للمستخدم: ${profile.full_name} (${email})` },
        }),
      ]);
    }

    globalLoginRateLimiter.clear(email, ip);
    const tFinalizeMs = Math.round(performance.now() - tFinalizeStart);
    const tTotalMs = Math.round(performance.now() - tStart);
    const redirectTo = getDefaultHomeRoute(bootstrap.permissions);

    return NextResponse.json(
      {
        ok: true,
        redirectTo,
        timings: { authMs: tAuthMs, finalizeMs: tFinalizeMs, totalMs: tTotalMs },
        session: data.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }
          : null,
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: bootstrap.fullName,
          role: bootstrap.role,
          shopId: bootstrap.shopId,
        },
        bootstrap,
      },
      {
        headers: {
          'Server-Timing': `auth;dur=${tAuthMs}, finalize;dur=${tFinalizeMs}, total;dur=${tTotalMs}`,
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    );
  }
}
