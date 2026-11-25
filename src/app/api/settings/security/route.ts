import { NextResponse } from 'next/server';
import { requireServerAuth } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  const auth = await requireServerAuth('settings.manage');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { supabase, shopId, userId, fullName, role } = auth.ctx;
  const body = await request.json().catch(() => ({}));
  const minutes = Math.max(5, Math.min(1440, parseInt(String(body.sessionTimeoutMinutes || 120), 10) || 120));

  const { error } = await supabase
    .from('shops')
    .update({ session_timeout_minutes: minutes, updated_at: new Date().toISOString() })
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
      sessionTimeoutMinutes: minutes,
      details: `تحديث مهلة انتهاء الجلسة إلى ${minutes} دقيقة`,
    },
  });

  return NextResponse.json({ ok: true, sessionTimeoutMinutes: minutes });
}
