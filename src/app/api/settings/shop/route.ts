import { NextResponse } from 'next/server';
import { requireServerAuth } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  const auth = await requireServerAuth('settings.manage');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { supabase, shopId, userId, fullName, role } = auth.ctx;

  if (role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'تعديل اسم المحل متاح لمدير النظام (Admin) فقط.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const rawName = typeof body.shopName === 'string' ? body.shopName.trim() : '';

  if (rawName.length < 2 || rawName.length > 80) {
    return NextResponse.json(
      { ok: false, error: 'يجب أن يكون اسم المحل بين حرفين و 80 حرفاً.' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('shops')
    .update({ name: rawName, updated_at: new Date().toISOString() })
    .eq('id', shopId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    table_name: 'shops',
    record_id: shopId,
    action: 'SETTINGS_UPDATE',
    changed_by: userId,
    actor_name: fullName,
    actor_role: role,
    new_data: {
      shopName: rawName,
      details: `تعديل اسم المحل إلى: ${rawName}`,
    },
  });

  return NextResponse.json({ ok: true, shopName: rawName });
}
