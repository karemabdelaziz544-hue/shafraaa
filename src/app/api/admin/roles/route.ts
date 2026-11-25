import { NextResponse } from 'next/server';
import { requireServerAuth } from '@/lib/supabase/server';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey,
  type RoleKey,
} from '@/lib/rbac';

export async function GET() {
  const auth = await requireServerAuth('users.manage');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { supabase, shopId } = auth.ctx;
  const { data, error } = await supabase
    .from('role_permissions')
    .select('role_key, permission_key, allowed')
    .eq('shop_id', shopId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const matrix: Record<RoleKey, Record<PermissionKey, boolean>> = {
    admin: {} as Record<PermissionKey, boolean>,
    cashier: {} as Record<PermissionKey, boolean>,
    accountant: {} as Record<PermissionKey, boolean>,
  };

  for (const r of ['admin', 'cashier', 'accountant'] as RoleKey[]) {
    for (const p of ALL_PERMISSIONS) {
      matrix[r][p] = DEFAULT_ROLE_PERMISSIONS[r].includes(p);
    }
  }

  (data || []).forEach((row: { role_key: string; permission_key: string; allowed: boolean }) => {
    const rk = row.role_key as RoleKey;
    const pk = row.permission_key as PermissionKey;
    if (matrix[rk] && ALL_PERMISSIONS.includes(pk)) {
      matrix[rk][pk] = rk === 'admin' ? true : Boolean(row.allowed);
    }
  });

  return NextResponse.json({ ok: true, rolePermissions: matrix });
}

export async function PUT(request: Request) {
  const auth = await requireServerAuth('users.manage');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { supabase, shopId, userId, fullName, role } = auth.ctx;

  try {
    const body = await request.json().catch(() => ({}));
    const targetRole = body.roleKey as RoleKey;

    if (targetRole !== 'cashier' && targetRole !== 'accountant') {
      return NextResponse.json(
        { ok: false, error: 'صلاحيات دور المدير (Admin) كاملة ودائمة ولا يمكن تقليصها.' },
        { status: 400 }
      );
    }

    const incomingPerms = body.permissions as Record<string, boolean> | undefined;
    if (!incomingPerms || typeof incomingPerms !== 'object') {
      return NextResponse.json({ ok: false, error: 'بيانات الصلاحيات غير صالحة' }, { status: 400 });
    }

    const rows = ALL_PERMISSIONS.map((perm) => ({
      shop_id: shopId,
      role_key: targetRole,
      permission_key: perm,
      allowed: Boolean(incomingPerms[perm]),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('role_permissions')
      .upsert(rows, { onConflict: 'shop_id,role_key,permission_key' });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const enabledCount = rows.filter((r) => r.allowed).length;
    await supabase.from('audit_logs').insert({
      shop_id: shopId,
      table_name: 'role_permissions',
      record_id: shopId,
      action: 'ROLE_PERMISSIONS_UPDATE',
      changed_by: userId,
      actor_name: fullName,
      actor_role: role,
      new_data: {
        targetRole,
        enabledCount,
        details: `تحديث صلاحيات دور (${targetRole === 'cashier' ? 'كاشير' : 'محاسب'}): ${enabledCount} صلاحية مفعلة`,
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'تم حفظ مصفوفة الصلاحيات وستُطبق فوراً في الطلب التالي دون إعادة نشر.',
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'خطأ في الحفظ' }, { status: 500 });
  }
}
