import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getClientIp } from '@/lib/supabase/server';
import { globalLoginRateLimiter } from '@/lib/auth-security';
import { normalizeRoleKey } from '@/lib/rbac';

export async function POST(request: Request) {
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

    // 1. فحص الحد من المحاولات الفاشلة في الذاكرة أولاً
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

    // 2. فحص الحد من المحاولات الفاشلة في قاعدة البيانات (إن وجدت الدالة)
    try {
      const { data: dbLimit } = await supabase.rpc('check_login_rate_limit', {
        p_email: email,
        p_ip: ip,
      });
      if (dbLimit && dbLimit.allowed === false) {
        const mins = Math.max(1, Math.ceil(Number(dbLimit.remaining_seconds || 60) / 60));
        return NextResponse.json(
          {
            ok: false,
            code: 'RATE_LIMITED',
            error: `تم حظر تسجيل الدخول مؤقتاً بسبب تكرار المحاولات الفاشلة. يرجى المحاولة بعد ${mins} دقيقة.`,
          },
          { status: 429 }
        );
      }
    } catch {
      // المتابعة في حال لم تُشغّل دالة القاعدة بعد
    }

    // 3. محاولة تسجيل الدخول عبر Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      const memRec = globalLoginRateLimiter.recordFailure(email, ip);
      try {
        await supabase.rpc('record_failed_login', { p_email: email, p_ip: ip });
      } catch {
        // تجاهل
      }

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

    // 4. التحقق من أن المستخدم نشط وغير موقوف من الإدارة
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('id, shop_id, full_name, role, is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profError || !profile) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, error: 'هذا الحساب غير مرتبط بمتجر بعد. تواصل مع مدير النظام.' },
        { status: 403 }
      );
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, code: 'ACCOUNT_DEACTIVATED', error: 'تم إيقاف هذا الحساب من قِبل مدير النظام ولا يمكنه الدخول.' },
        { status: 403 }
      );
    }

    // 5. نجاح الدخول: مسح عداد الفشل وتسجيل الدخول في سجل التدقيق
    globalLoginRateLimiter.clear(email, ip);
    try {
      await supabase.rpc('clear_login_rate_limit', { p_email: email, p_ip: ip });
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
        .eq('id', data.user.id);
      await supabase.from('audit_logs').insert({
        shop_id: profile.shop_id,
        table_name: 'auth',
        record_id: data.user.id,
        action: 'LOGIN',
        changed_by: data.user.id,
        actor_name: profile.full_name,
        actor_role: normalizeRoleKey(profile.role),
        new_data: { details: `تسجيل دخول ناجح للمستخدم: ${profile.full_name} (${email})` },
      });
    } catch {
      // عدم تعطيل تسجيل الدخول بسبب سجل التدقيق فقط
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: profile.full_name,
        role: normalizeRoleKey(profile.role),
        shopId: profile.shop_id,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    );
  }
}
