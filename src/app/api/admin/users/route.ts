import { NextResponse } from 'next/server';
import {
  createAdminSupabaseClient,
  createEphemeralAnonClient,
  requireServerAuth,
} from '@/lib/supabase/server';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRoleKey,
  type PermissionKey,
  type RoleKey,
} from '@/lib/rbac';

export async function GET() {
  const auth = await requireServerAuth('users.manage');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { supabase, shopId } = auth.ctx;

  const [profilesRes, rolesRes, rolePermsRes, overridesRes, invitesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, shop_id, full_name, email, role, is_active, last_login_at, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true }),
    supabase
      .from('roles')
      .select('*')
      .eq('shop_id', shopId),
    supabase
      .from('role_permissions')
      .select('role_key, permission_key, allowed')
      .eq('shop_id', shopId),
    supabase
      .from('user_permission_overrides')
      .select('user_id, permission_key, allowed')
      .eq('shop_id', shopId),
    supabase
      .from('user_invitations')
      .select('*')
      .eq('shop_id', shopId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  if (profilesRes.error) {
    return NextResponse.json({ ok: false, error: profilesRes.error.message }, { status: 400 });
  }

  const rolePermissions: Record<RoleKey, Record<PermissionKey, boolean>> = {
    admin: {} as Record<PermissionKey, boolean>,
    cashier: {} as Record<PermissionKey, boolean>,
    accountant: {} as Record<PermissionKey, boolean>,
  };

  for (const r of ['admin', 'cashier', 'accountant'] as RoleKey[]) {
    for (const p of ALL_PERMISSIONS) {
      rolePermissions[r][p] = DEFAULT_ROLE_PERMISSIONS[r].includes(p);
    }
  }

  (rolePermsRes.data || []).forEach((row: { role_key: string; permission_key: string; allowed: boolean }) => {
    const rk = normalizeRoleKey(row.role_key);
    const pk = row.permission_key as PermissionKey;
    if (ALL_PERMISSIONS.includes(pk)) {
      rolePermissions[rk][pk] = rk === 'admin' ? true : Boolean(row.allowed);
    }
  });

  const overridesByUser: Record<string, Partial<Record<PermissionKey, boolean>>> = {};
  (overridesRes.data || []).forEach((ov: { user_id: string; permission_key: string; allowed: boolean }) => {
    const pk = ov.permission_key as PermissionKey;
    if (!ALL_PERMISSIONS.includes(pk)) return;
    if (!overridesByUser[ov.user_id]) overridesByUser[ov.user_id] = {};
    overridesByUser[ov.user_id][pk] = Boolean(ov.allowed);
  });

  const users = (profilesRes.data || []).map((p: any) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email || '',
    role: normalizeRoleKey(p.role),
    isActive: Boolean(p.is_active),
    lastLoginAt: p.last_login_at || null,
    createdAt: p.created_at,
    overrides: overridesByUser[p.id] || {},
  }));

  return NextResponse.json({
    ok: true,
    hasServiceRole: Boolean(createAdminSupabaseClient()),
    users,
    roles: rolesRes.data || [],
    rolePermissions,
    invitations: invitesRes.data || [],
  });
}

export async function POST(request: Request) {
  const auth = await requireServerAuth('users.manage');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { supabase, shopId, userId, fullName: actorName, role: actorRole } = auth.ctx;

  try {
    const body = await request.json().catch(() => ({}));
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = normalizeRoleKey(typeof body.role === 'string' ? body.role : 'cashier');
    const mode = body.mode === 'invite' ? 'invite' : 'password';
    const temporaryPassword = typeof body.temporaryPassword === 'string' ? body.temporaryPassword : '';
    const isActive = body.isActive !== false;

    if (!fullName || !email) {
      return NextResponse.json(
        { ok: false, error: 'يرجى إدخال الاسم والبريد الإلكتروني للمستخدم الجديد' },
        { status: 400 }
      );
    }

    if (mode === 'password' && temporaryPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'كلمة المرور المؤقتة يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      );
    }

    // التحقق من عدم وجود مستخدم نشط بنفس البريد في المتجر
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('shop_id', shopId)
      .ilike('email', email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { ok: false, error: 'يوجد مستخدم مسجل بهذا البريد الإلكتروني بالفعل في المتجر' },
        { status: 409 }
      );
    }

    // تسجيل الدعوة الآمنة المرتبطة بـ shop_id
    const { error: invErr } = await supabase.from('user_invitations').upsert(
      {
        shop_id: shopId,
        email,
        full_name: fullName,
        role,
        is_active: isActive,
        invited_by: userId,
        accepted_at: null,
      },
      { onConflict: 'shop_id,email' }
    );

    if (invErr) {
      return NextResponse.json(
        { ok: false, error: `تعذر تسجيل سجل الدعوة: ${invErr.message}` },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;
    const adminSb = createAdminSupabaseClient();
    let createdUserId: string | null = null;
    let statusMessage = '';

    if (adminSb) {
      if (mode === 'invite') {
        const { data: invData, error: inviteErr } = await adminSb.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${origin}/auth/callback?next=/login`,
          data: { full_name: fullName, role },
        });
        if (inviteErr) {
          return NextResponse.json({ ok: false, error: inviteErr.message }, { status: 400 });
        }
        createdUserId = invData.user?.id || null;
        statusMessage = `تم إرسال رابط دعوة إلى ${email} بدور (${role}).`;
      } else {
        const { data: created, error: createErr } = await adminSb.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName, role },
        });
        if (createErr || !created.user) {
          return NextResponse.json(
            { ok: false, error: createErr?.message || 'تعذر إنشاء الحساب في Supabase Auth' },
            { status: 400 }
          );
        }
        createdUserId = created.user.id;
        await adminSb.from('profiles').upsert({
          id: createdUserId,
          shop_id: shopId,
          full_name: fullName,
          email,
          role,
          is_active: isActive,
          created_by: userId,
        });
        await adminSb
          .from('user_invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('shop_id', shopId)
          .eq('email', email);
        statusMessage = `تم إنشاء المستخدم "${fullName}" بكلمة مرور مؤقتة وتفعيله فوراً.`;
      }
    } else {
      // بدون SERVICE_ROLE_KEY: استخدام عميل معزول لا يغير جلسة المدير الحالية
      const eph = createEphemeralAnonClient();
      if (!eph) {
        return NextResponse.json({ ok: false, error: 'تعذر تهيئة عميل Supabase' }, { status: 500 });
      }
      const passwordToUse =
        mode === 'password'
          ? temporaryPassword
          : `Shafra#${Math.random().toString(36).slice(2, 10)}9A`;
      const { data: signUpRes, error: signUpErr } = await eph.auth.signUp({
        email,
        password: passwordToUse,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/login`,
          data: { full_name: fullName, role },
        },
      });
      if (signUpErr) {
        return NextResponse.json({ ok: false, error: signUpErr.message }, { status: 400 });
      }
      createdUserId = signUpRes.user?.id || null;
      statusMessage =
        mode === 'invite'
          ? `تم تسجيل دعوة للمستخدم "${fullName}" وإرسال رسالة التفعيل إلى ${email}.`
          : `تم تسجيل "${fullName}" بكلمة المرور المؤقتة وربطه بالمتجر (قد يتطلب تأكيد البريد إذا كان مفعلاً في إعدادات Supabase Auth).`;
    }

    await supabase.from('audit_logs').insert({
      shop_id: shopId,
      table_name: 'profiles',
      record_id: createdUserId || shopId,
      action: 'USER_CREATE',
      changed_by: userId,
      actor_name: actorName,
      actor_role: actorRole,
      new_data: {
        email,
        role,
        details: `إنشاء مستخدم جديد: ${fullName} (${email}) بدور ${role}`,
      },
    });

    return NextResponse.json({ ok: true, userId: createdUserId, message: statusMessage });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ أثناء إنشاء المستخدم' },
      { status: 500 }
    );
  }
}
