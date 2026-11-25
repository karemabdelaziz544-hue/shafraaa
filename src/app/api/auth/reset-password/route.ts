import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getClientIp } from '@/lib/supabase/server';
import { LoginRateLimiter } from '@/lib/auth-security';

const resetLimiter = new LoginRateLimiter();

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const ip = getClientIp(request);

    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'يرجى إدخال البريد الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور' },
        { status: 400 }
      );
    }

    const limitCheck = resetLimiter.check(`reset:${email}`, ip);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { ok: false, error: 'تم إرسال عدة طلبات مؤخراً، يرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.' },
        { status: 429 }
      );
    }
    resetLimiter.recordFailure(`reset:${email}`, ip);

    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'إعدادات Supabase غير متوفرة' }, { status: 503 });
    }

    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/login`,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: 'إذا كان البريد مسجلاً لدينا، فقد تم إرسال رابط إعادة تعيين كلمة المرور إليه بنجاح.',
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'تعذر إرسال رابط الاستعادة' }, { status: 500 });
  }
}
