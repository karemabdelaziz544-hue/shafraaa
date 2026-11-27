import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import {
  ALL_PERMISSIONS,
  canAccessRoute,
  normalizeRoleKey,
  resolveEffectivePermissions,
  type PermissionKey,
} from '@/lib/rbac';

const SKIP_PATHS = [
  '/login',
  '/auth/callback',
  '/api/auth/',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  // أي مستخدم غير مسجل الدخول يُوجّه فوراً إلى صفحة الدخول (حتى /no-permission)
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // مسارات API تتحقق بنفسها عبر requireServerAuth، و/no-permission متاح للمسجلين فقط
  if (pathname.startsWith('/api/') || pathname === '/no-permission') {
    return response;
  }

  // طلبات prefetch الخلفية لا تحتاج 3 استعلامات DB متكررة بعد التحقق من المستخدم
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch';
  if (isPrefetch) {
    return response;
  }

  // استعلام سريع موحد لبيانات الدور والصلاحيات في جولة واحدة بدلاً من 3 جولات
  let ctxData: {
    found?: boolean;
    shopId?: string;
    role?: string;
    isActive?: boolean;
    rolePermissions?: Record<string, boolean>;
    userOverrides?: Record<string, boolean>;
  } | null = null;

  try {
    const { data, error } = await supabase.rpc('get_middleware_auth_context');
    if (!error && data) {
      ctxData = data as any;
    }
  } catch {
    ctxData = null;
  }

  if (ctxData) {
    if (!ctxData.found) {
      return response;
    }

    if (!ctxData.isActive) {
      await supabase.auth.signOut();
      const loginUrl = new URL('/login?deactivated=1', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const role = normalizeRoleKey(ctxData.role);
    if (role === 'admin') {
      return response;
    }

    const effective = resolveEffectivePermissions({
      role,
      rolePermissions: (ctxData.rolePermissions || {}) as Partial<Record<PermissionKey, boolean>>,
      userOverrides: (ctxData.userOverrides || {}) as Partial<Record<PermissionKey, boolean>>,
    });

    if (!canAccessRoute(pathname, effective)) {
      const blockedUrl = new URL('/no-permission', request.url);
      return NextResponse.redirect(blockedUrl);
    }

    return response;
  }

  // مسار احتياطي في حال عدم تشغيل Migration 7 بعد
  const { data: profile } = await supabase
    .from('profiles')
    .select('shop_id, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return response;
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    const loginUrl = new URL('/login?deactivated=1', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const role = normalizeRoleKey(profile.role);
  if (role === 'admin') {
    return response;
  }

  const [rolePermsRes, overridesRes] = await Promise.all([
    supabase
      .from('role_permissions')
      .select('permission_key, allowed')
      .eq('shop_id', profile.shop_id)
      .eq('role_key', role),
    supabase
      .from('user_permission_overrides')
      .select('permission_key, allowed')
      .eq('shop_id', profile.shop_id)
      .eq('user_id', user.id),
  ]);

  const roleMap: Partial<Record<PermissionKey, boolean>> = {};
  (rolePermsRes.data || []).forEach((r: { permission_key: string; allowed: boolean }) => {
    if (ALL_PERMISSIONS.includes(r.permission_key as PermissionKey)) {
      roleMap[r.permission_key as PermissionKey] = Boolean(r.allowed);
    }
  });

  const ovMap: Partial<Record<PermissionKey, boolean>> = {};
  (overridesRes.data || []).forEach((ov: { permission_key: string; allowed: boolean }) => {
    if (ALL_PERMISSIONS.includes(ov.permission_key as PermissionKey)) {
      ovMap[ov.permission_key as PermissionKey] = Boolean(ov.allowed);
    }
  });

  const effective = resolveEffectivePermissions({
    role,
    rolePermissions: roleMap,
    userOverrides: ovMap,
  });

  if (!canAccessRoute(pathname, effective)) {
    const blockedUrl = new URL('/no-permission', request.url);
    return NextResponse.redirect(blockedUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
