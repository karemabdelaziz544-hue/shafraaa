import { NextResponse } from 'next/server';
import { requireServerAuth } from '@/lib/supabase/server';

export async function GET() {
  const auth = await requireServerAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    userId: auth.ctx.userId,
    email: auth.ctx.email,
    fullName: auth.ctx.fullName,
    shopId: auth.ctx.shopId,
    role: auth.ctx.role,
    isActive: auth.ctx.isActive,
    permissions: auth.ctx.permissions,
    sessionTimeoutMinutes: auth.ctx.sessionTimeoutMinutes,
  });
}
