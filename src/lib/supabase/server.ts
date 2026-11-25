import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  ALL_PERMISSIONS,
  normalizeRoleKey,
  resolveEffectivePermissions,
  type PermissionKey,
  type RoleKey,
} from '@/lib/rbac';

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

export function createServerSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;

  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // تجاهل في مكونات السيرفر للقراءة فقط
        }
      },
    },
  });
}

export function createAdminSupabaseClient(): SupabaseClient | null {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) return null;
  return createSupabaseAdminClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createEphemeralAnonClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;
  return createSupabaseAdminClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface ServerAuthContext {
  supabase: SupabaseClient;
  userId: string;
  email: string;
  fullName: string;
  shopId: string;
  role: RoleKey;
  isActive: boolean;
  permissions: Record<PermissionKey, boolean>;
  sessionTimeoutMinutes: number;
}

export type ServerAuthResult =
  | { ok: true; ctx: ServerAuthContext }
  | { ok: false; status: number; error: string };

export async function requireServerAuth(requiredPermission?: PermissionKey): Promise<ServerAuthResult> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, status: 503, error: 'إعدادات Supabase غير متوفرة على الخادم' };
  }

  const { data: userRes, error: authErr } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (authErr || !user) {
    return { ok: false, status: 401, error: 'يجب تسجيل الدخول أولاً' };
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, shop_id, full_name, role, is_active, shops(session_timeout_minutes)')
    .eq('id', user.id)
    .maybeSingle();

  if (profErr || !profile) {
    return { ok: false, status: 403, error: 'تعذر التحقق من ملف المستخدم' };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { ok: false, status: 403, error: 'تم إيقاف هذا الحساب من قِبل مدير النظام' };
  }

  const role = normalizeRoleKey(profile.role);
  const shopRow = Array.isArray(profile.shops) ? profile.shops[0] : profile.shops;
  const sessionTimeoutMinutes = Number((shopRow as { session_timeout_minutes?: number } | null)?.session_timeout_minutes || 120);

  let permissions: Record<PermissionKey, boolean>;
  if (role === 'admin') {
    permissions = resolveEffectivePermissions({ role: 'admin' });
  } else {
    const [rolePermsRes, overrideRes] = await Promise.all([
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

    const rolePermMap: Partial<Record<PermissionKey, boolean>> = {};
    (rolePermsRes.data || []).forEach((rp: { permission_key: string; allowed: boolean }) => {
      if (ALL_PERMISSIONS.includes(rp.permission_key as PermissionKey)) {
        rolePermMap[rp.permission_key as PermissionKey] = Boolean(rp.allowed);
      }
    });

    const overrideMap: Partial<Record<PermissionKey, boolean>> = {};
    (overrideRes.data || []).forEach((ov: { permission_key: string; allowed: boolean }) => {
      if (ALL_PERMISSIONS.includes(ov.permission_key as PermissionKey)) {
        overrideMap[ov.permission_key as PermissionKey] = Boolean(ov.allowed);
      }
    });

    permissions = resolveEffectivePermissions({
      role,
      rolePermissions: rolePermMap,
      userOverrides: overrideMap,
    });
  }

  if (requiredPermission && !permissions[requiredPermission]) {
    return {
      ok: false,
      status: 403,
      error: 'غير مصرح لك بتنفيذ هذا الإجراء حسب صلاحيات حسابك',
    };
  }

  return {
    ok: true,
    ctx: {
      supabase,
      userId: user.id,
      email: user.email || '',
      fullName: profile.full_name || 'المستخدم',
      shopId: profile.shop_id,
      role,
      isActive: Boolean(profile.is_active),
      permissions,
      sessionTimeoutMinutes,
    },
  };
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
