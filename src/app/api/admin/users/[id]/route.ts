import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, requireServerAuth } from '@/lib/supabase/server';
import {
  ALL_PERMISSIONS,
  canManageAdminChange,
  normalizeRoleKey,
  type PermissionKey,
} from '@/lib/rbac';

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireServerAuth('users.manage');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const targetUserId = context.params.id;
  const { supabase, shopId, userId, fullName: actorName, role: actorRole } = auth.ctx;

  try {
    const body = await request.json().catch(() => ({}));

    const { data: allProfiles, error: listErr } = await supabase
      .from('profiles')
      .select('id, shop_id, full_name, email, role, is_active')
      .eq('shop_id', shopId);

    if (listErr) {
      return NextResponse.json({ ok: false, error: listErr.message }, { status: 400 });
    }

    const target = (allProfiles || []).find((p: any) => p.id === targetUserId);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'المستخدم غير موجود في هذا المتجر' }, { status: 404 });
    }

    const activeAdminCount = (allProfiles || []).filter(
      (p: any) => normalizeRoleKey(p.role) === 'admin' && p.is_active
    ).length;
    const targetIsActiveAdmin = normalizeRoleKey(target.role) === 'admin' && Boolean(target.is_active);

    const nextRole = body.role ? normalizeRoleKey(body.role) : normalizeRoleKey(target.role);
    const nextIsActive =
      typeof body.isActive === 'boolean' ? body.isActive : Boolean(target.is_active);

    if (targetIsActiveAdmin && nextRole !== 'admin') {
      const guard = canManageAdminChange({
        activeAdminCount,
        targetIsActiveAdmin,
        action: 'demote',
      });
      if (!guard.allowed) {
        return NextResponse.json({ ok: false, error: guard.reason }, { status: 400 });
      }
    }

    if (targetIsActiveAdmin && nextIsActive === false) {
      const guard = canManageAdminChange({
        activeAdminCount,
        targetIsActiveAdmin,
        action: 'deactivate',
      });
      if (!guard.allowed) {
        return NextResponse.json({ ok: false, error: guard.reason }, { status: 400 });
      }
    }

    const profileUpdates: Record<string, any> = {
      role: nextRole,
      is_active: nextIsActive,
      updated_at: new Date().toISOString(),
    };
    if (typeof body.fullName === 'string' && body.fullName.trim()) {
      profileUpdates.full_name = body.fullName.trim();
    }

    const { error: updErr } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', targetUserId)
      .eq('shop_id', shopId);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    }

    // تحديث تجاوزات الصلاحيات الفردية إن أُرسلت (inherit = null يحذف التجاوز)
    if (body.overrides && typeof body.overrides === 'object') {
      for (const [permKey, val] of Object.entries(body.overrides)) {
        if (!ALL_PERMISSIONS.includes(permKey as PermissionKey)) continue;
        if (val === 'inherit' || val === null) {
          await supabase
            .from('user_permission_overrides')
            .delete()
            .eq('shop_id', shopId)
            .eq('user_id', targetUserId)
            .eq('permission_key', permKey);
        } else if (typeof val === 'boolean') {
          await supabase.from('user_permission_overrides').upsert(
            {
              shop_id: shopId,
              user_id: targetUserId,
              permission_key: permKey,
              allowed: val,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'shop_id,user_id,permission_key' }
          );
        }
      }
    }

    let passwordMessage = '';
    // إعادة تعيين كلمة المرور من الإدارة
    if (typeof body.newPassword === 'string' && body.newPassword.length >= 6) {
      const adminSb = createAdminSupabaseClient();
      if (adminSb) {
        const { error: pwErr } = await adminSb.auth.admin.updateUserById(targetUserId, {
          password: body.newPassword,
        });
        if (pwErr) {
          return NextResponse.json({ ok: false, error: pwErr.message }, { status: 400 });
        }
        passwordMessage = 'تم تحديث كلمة المرور بنجاح.';
      } else if (target.email) {
        const origin = new URL(request.url).origin;
        await supabase.auth.resetPasswordForEmail(target.email, {
          redirectTo: `${origin}/auth/callback?next=/login`,
        });
        passwordMessage = `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${target.email} (لعدم تفعيل SUPABASE_SERVICE_ROLE_KEY على الخادم).`;
      }
    } else if (body.sendResetEmail && target.email) {
      const origin = new URL(request.url).origin;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(target.email, {
        redirectTo: `${origin}/auth/callback?next=/login`,
      });
      if (resetErr) {
        return NextResponse.json({ ok: false, error: resetErr.message }, { status: 400 });
      }
      passwordMessage = `تم إرسال رابط استعادة كلمة المرور إلى ${target.email}.`;
    }

    await supabase.from('audit_logs').insert({
      shop_id: shopId,
      table_name: 'profiles',
      record_id: targetUserId,
      action: 'USER_UPDATE',
      changed_by: userId,
      actor_name: actorName,
      actor_role: actorRole,
      new_data: {
        targetUserId,
        role: nextRole,
        isActive: nextIsActive,
        details: `تعديل بيانات/صلاحيات المستخدم ${target.full_name} (الدور: ${nextRole}، الحالة: ${nextIsActive ? 'نشط' : 'موقوف'})`,
      },
    });

    return NextResponse.json({
      ok: true,
      message: passwordMessage || 'تم تحديث بيانات وصلاحيات المستخدم بنجاح',
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ أثناء تحديث المستخدم' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireServerAuth('users.manage');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const targetUserId = context.params.id;
  const { supabase, shopId, userId, fullName: actorName, role: actorRole } = auth.ctx;

  if (targetUserId === userId) {
    return NextResponse.json(
      { ok: false, error: 'لا يمكنك حذف حسابك الشخصي أثناء تسجيل الدخول به' },
      { status: 400 }
    );
  }

  const { data: allProfiles, error: listErr } = await supabase
    .from('profiles')
    .select('id, shop_id, full_name, email, role, is_active')
    .eq('shop_id', shopId);

  if (listErr) {
    return NextResponse.json({ ok: false, error: listErr.message }, { status: 400 });
  }

  const target = (allProfiles || []).find((p: any) => p.id === targetUserId);
  if (!target) {
    return NextResponse.json({ ok: false, error: 'المستخدم غير موجود' }, { status: 404 });
  }

  const activeAdminCount = (allProfiles || []).filter(
    (p: any) => normalizeRoleKey(p.role) === 'admin' && p.is_active
  ).length;
  const targetIsActiveAdmin = normalizeRoleKey(target.role) === 'admin' && Boolean(target.is_active);

  const guard = canManageAdminChange({
    activeAdminCount,
    targetIsActiveAdmin,
    action: 'delete',
  });
  if (!guard.allowed) {
    return NextResponse.json({ ok: false, error: guard.reason }, { status: 400 });
  }

  const adminSb = createAdminSupabaseClient();
  if (adminSb) {
    const { error: authDelErr } = await adminSb.auth.admin.deleteUser(targetUserId);
    if (authDelErr) {
      return NextResponse.json({ ok: false, error: authDelErr.message }, { status: 400 });
    }
  } else {
    const { error: profDelErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', targetUserId)
      .eq('shop_id', shopId);
    if (profDelErr) {
      return NextResponse.json({ ok: false, error: profDelErr.message }, { status: 400 });
    }
  }

  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    table_name: 'profiles',
    record_id: targetUserId,
    action: 'USER_DELETE',
    changed_by: userId,
    actor_name: actorName,
    actor_role: actorRole,
    new_data: {
      details: `حذف المستخدم: ${target.full_name} (${target.email || targetUserId})`,
    },
  });

  return NextResponse.json({ ok: true, message: `تم حذف المستخدم "${target.full_name}" بنجاح` });
}
