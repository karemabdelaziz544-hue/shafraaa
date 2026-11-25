'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users,
  KeyRound,
  Sliders,
  Trash2,
  CheckCircle2,
  XCircle,
  Mail,
  Lock,
  Unlock,
  RefreshCw,
  Edit3,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLE_LABELS,
  canManageAdminChange,
  normalizeRoleKey,
  type PermissionKey,
  type RoleKey,
} from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { useToast } from '@/components/motion/toast-provider';
import { ICON_TOKENS } from '@/lib/design-tokens';
import { formatArabicDateTime } from '@/lib/formatters';

interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  role: RoleKey;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  overrides: Partial<Record<PermissionKey, boolean>>;
}

interface PendingInvitation {
  id: string;
  email: string;
  full_name: string;
  role: RoleKey;
  created_at: string;
}

type OverrideState = 'inherit' | 'allow' | 'deny';

export default function UsersPermissionsPage() {
  const { userId, can, refreshFromCloud } = useShop();
  const { successToast, errorToast } = useToast();

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [isLoading, setIsLoading] = useState(true);
  const [hasServiceRole, setHasServiceRole] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [roleMatrix, setRoleMatrix] = useState<Record<RoleKey, Record<PermissionKey, boolean>>>({
    admin: Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, true])) as Record<PermissionKey, boolean>,
    cashier: Object.fromEntries(
      ALL_PERMISSIONS.map((p) => [p, DEFAULT_ROLE_PERMISSIONS.cashier.includes(p)])
    ) as Record<PermissionKey, boolean>,
    accountant: Object.fromEntries(
      ALL_PERMISSIONS.map((p) => [p, DEFAULT_ROLE_PERMISSIONS.accountant.includes(p)])
    ) as Record<PermissionKey, boolean>,
  });

  // مودال إنشاء مستخدم
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<RoleKey>('cashier');
  const [createMode, setCreateMode] = useState<'password' | 'invite'>('password');
  const [tempPassword, setTempPassword] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // مودال تعديل مستخدم / إعادة تعيين كلمة مرور
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<RoleKey>('cashier');
  const [editIsActive, setEditIsActive] = useState(true);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // مودال التجاوزات الفردية للمستخدم
  const [overrideUser, setOverrideUser] = useState<ManagedUser | null>(null);
  const [draftOverrides, setDraftOverrides] = useState<Record<PermissionKey, OverrideState>>(
    {} as Record<PermissionKey, OverrideState>
  );
  const [isSavingOverrides, setIsSavingOverrides] = useState(false);

  // مودال تأكيد الحذف
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // حفظ مصفوفة الدور
  const [selectedMatrixRole, setSelectedMatrixRole] = useState<'cashier' | 'accountant'>('cashier');
  const [isSavingRoleMatrix, setIsSavingRoleMatrix] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        errorToast(data.error || 'تعذر تحميل بيانات المستخدمين والصلاحيات');
        return;
      }
      setHasServiceRole(Boolean(data.hasServiceRole));
      setUsers(data.users || []);
      setInvitations(data.invitations || []);
      if (data.rolePermissions) {
        setRoleMatrix(data.rolePermissions);
      }
    } catch {
      errorToast('تعذر الاتصال بالخادم لجلب المستخدمين');
    } finally {
      setIsLoading(false);
    }
  }, [errorToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeAdminCount = useMemo(
    () => users.filter((u) => normalizeRoleKey(u.role) === 'admin' && u.isActive).length,
    [users]
  );

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, typeof PERMISSION_DEFINITIONS>();
    PERMISSION_DEFINITIONS.forEach((p) => {
      const arr = groups.get(p.group) || [];
      arr.push(p);
      groups.set(p.group, arr);
    });
    return Array.from(groups.entries());
  }, []);

  if (!can('users.manage')) {
    return null;
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      errorToast('أدخل الاسم والبريد الإلكتروني');
      return;
    }
    if (createMode === 'password' && tempPassword.length < 6) {
      errorToast('كلمة المرور المؤقتة يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
          mode: createMode,
          temporaryPassword: createMode === 'password' ? tempPassword : '',
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        errorToast(data.error || 'تعذر إنشاء المستخدم');
        return;
      }

      successToast(data.message || 'تمت إضافة المستخدم بنجاح');
      setIsCreateOpen(false);
      setNewName('');
      setNewEmail('');
      setNewRole('cashier');
      setTempPassword('');
      await loadData();
    } catch {
      errorToast('حدث خطأ أثناء إنشاء المستخدم');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const openEditUser = (u: ManagedUser) => {
    setEditingUser(u);
    setEditName(u.fullName);
    setEditRole(u.role);
    setEditIsActive(u.isActive);
    setResetPasswordInput('');
  };

  const handleSaveUserEdit = async (sendResetEmail = false) => {
    if (!editingUser) return;
    const isTargetActiveAdmin = editingUser.role === 'admin' && editingUser.isActive;
    if (isTargetActiveAdmin && editRole !== 'admin') {
      const guard = canManageAdminChange({ activeAdminCount, targetIsActiveAdmin: true, action: 'demote' });
      if (!guard.allowed) {
        errorToast(guard.reason || 'لا يمكن تخفيض رتبة آخر مدير');
        return;
      }
    }
    if (isTargetActiveAdmin && !editIsActive) {
      const guard = canManageAdminChange({ activeAdminCount, targetIsActiveAdmin: true, action: 'deactivate' });
      if (!guard.allowed) {
        errorToast(guard.reason || 'لا يمكن إيقاف آخر مدير');
        return;
      }
    }

    setIsSavingUser(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: editName.trim(),
        role: editRole,
        isActive: editIsActive,
      };
      if (resetPasswordInput.length >= 6) {
        payload.newPassword = resetPasswordInput;
      } else if (sendResetEmail) {
        payload.sendResetEmail = true;
      }

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        errorToast(data.error || 'تعذر تحديث بيانات المستخدم');
        return;
      }

      successToast(data.message || 'تم تحديث المستخدم بنجاح');
      setEditingUser(null);
      await loadData();
      await refreshFromCloud();
    } catch {
      errorToast('تعذر الاتصال بالخادم لتحديث المستخدم');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleToggleUserStatus = async (u: ManagedUser) => {
    if (u.role === 'admin' && u.isActive) {
      const guard = canManageAdminChange({ activeAdminCount, targetIsActiveAdmin: true, action: 'deactivate' });
      if (!guard.allowed) {
        errorToast(guard.reason || 'لا يمكن تعطيل آخر مدير');
        return;
      }
    }
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        errorToast(data.error || 'تعذر تغيير حالة الحساب');
        return;
      }
      successToast(!u.isActive ? `تم تفعيل حساب ${u.fullName}` : `تم إيقاف حساب ${u.fullName} وفصل جلسته`);
      await loadData();
    } catch {
      errorToast('خطأ في الاتصال أثناء تغيير الحالة');
    }
  };

  const openOverridesModal = (u: ManagedUser) => {
    setOverrideUser(u);
    const map = {} as Record<PermissionKey, OverrideState>;
    ALL_PERMISSIONS.forEach((p) => {
      if (typeof u.overrides?.[p] === 'boolean') {
        map[p] = u.overrides[p] ? 'allow' : 'deny';
      } else {
        map[p] = 'inherit';
      }
    });
    setDraftOverrides(map);
  };

  const handleSaveOverrides = async () => {
    if (!overrideUser) return;
    setIsSavingOverrides(true);
    try {
      const overridesPayload: Record<string, boolean | 'inherit'> = {};
      ALL_PERMISSIONS.forEach((p) => {
        const val = draftOverrides[p];
        overridesPayload[p] = val === 'allow' ? true : val === 'deny' ? false : 'inherit';
      });

      const res = await fetch(`/api/admin/users/${overrideUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: overridesPayload }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        errorToast(data.error || 'تعذر حفظ التجاوزات الفردية');
        return;
      }

      successToast(`تم حفظ الصلاحيات الخاصة لـ ${overrideUser.fullName} (تُطبق فوراً في الطلب التالي)`);
      setOverrideUser(null);
      await loadData();
      await refreshFromCloud();
    } catch {
      errorToast('تعذر الاتصال بالخادم');
    } finally {
      setIsSavingOverrides(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        errorToast(data.error || 'تعذر حذف المستخدم');
        return;
      }
      successToast(data.message || 'تم حذف المستخدم');
      setDeletingUser(null);
      await loadData();
    } catch {
      errorToast('تعذر الاتصال بالخادم أثناء الحذف');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleToggleRolePerm = (perm: PermissionKey) => {
    setRoleMatrix((prev) => ({
      ...prev,
      [selectedMatrixRole]: {
        ...prev[selectedMatrixRole],
        [perm]: !prev[selectedMatrixRole]?.[perm],
      },
    }));
  };

  const handleResetRoleToDefaults = () => {
    const defaults = Object.fromEntries(
      ALL_PERMISSIONS.map((p) => [p, DEFAULT_ROLE_PERMISSIONS[selectedMatrixRole].includes(p)])
    ) as Record<PermissionKey, boolean>;
    setRoleMatrix((prev) => ({ ...prev, [selectedMatrixRole]: defaults }));
  };

  const handleSaveRolePermissions = async () => {
    setIsSavingRoleMatrix(true);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleKey: selectedMatrixRole,
          permissions: roleMatrix[selectedMatrixRole],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        errorToast(data.error || 'تعذر حفظ صلاحيات الدور');
        return;
      }
      successToast(`تم حفظ صلاحيات دور (${ROLE_LABELS[selectedMatrixRole]}) وتطبيقها فوراً`);
      await refreshFromCloud();
    } catch {
      errorToast('تعذر الاتصال بالخادم أثناء الحفظ');
    } finally {
      setIsSavingRoleMatrix(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* الرأس */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <ShieldCheck strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>المستخدمون والصلاحيات (RBAC)</span>
          </h1>
          <p className="text-xs text-ink-muted">
            إدارة فريق العمل والأدوار والتجاوزات الفردية — التغييرات تُطبق فوراً دون إعادة نشر
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={() => void loadData()} isLoading={isLoading}>
            <RefreshCw strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
            <span>تحديث</span>
          </Button>
          <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
            <UserPlus strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
            <span>إضافة مستخدم</span>
          </Button>
        </div>
      </div>

      {/* تنبيه وضع الإنشاء بدون مفتاح الخدمة */}
      {!hasServiceRole && !isLoading && (
        <div className="p-3.5 rounded-2xl bg-warning-bg border border-warning-border text-warning text-xs flex items-start gap-2.5">
          <Info strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p className="font-bold">وضع العمل بدون SUPABASE_SERVICE_ROLE_KEY على الخادم:</p>
            <p>
              تعمل إضافة المستخدمين بأمان عبر إنشاء الحساب أو إرسال الدعوة وربطه تلقائياً بدوره عبر قاعدة البيانات. لتفعيل الحذف الفوري من Auth وتغيير كلمة المرور المباشر بدون إيميل تأكيد، أضف{' '}
              <code className="font-mono font-bold">SUPABASE_SERVICE_ROLE_KEY</code> في متغيرات البيئة.
            </p>
          </div>
        </div>
      )}

      {/* بطاقات ملخص الفريق */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-muted font-semibold">إجمالي المستخدمين</p>
              <p className="text-2xl font-black text-ink-strong mt-1">{users.length}</p>
            </div>
            <Users strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-muted font-semibold">الحسابات النشطة</p>
              <p className="text-2xl font-black text-success mt-1">{users.filter((u) => u.isActive).length}</p>
            </div>
            <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-success" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-muted font-semibold">المديرون النشطون</p>
              <p className="text-2xl font-black text-ink-strong mt-1">{activeAdminCount}</p>
            </div>
            <ShieldCheck strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-flame" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-muted font-semibold">دعوات قيد التفعيل</p>
              <p className="text-2xl font-black text-info mt-1">{invitations.length}</p>
            </div>
            <Mail strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-info" />
          </CardContent>
        </Card>
      </div>

      {/* التبويبات */}
      <div className="flex items-center gap-2 bg-surface p-1.5 rounded-2xl border border-line w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            activeTab === 'users'
              ? 'bg-flame text-abyssal shadow-sm'
              : 'text-ink-muted hover:text-ink-strong'
          }`}
        >
          قائمة المستخدمين ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            activeTab === 'roles'
              ? 'bg-flame text-abyssal shadow-sm'
              : 'text-ink-muted hover:text-ink-strong'
          }`}
        >
          مصفوفة صلاحيات الأدوار
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4">
                  <TableSkeletonRows rows={4} />
                </div>
              ) : users.length === 0 ? (
                <div className="p-10 text-center text-ink-muted text-sm">لا يوجد مستخدمون بعد.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-surface-alt border-b border-line text-xs text-ink-muted">
                      <tr>
                        <th className="p-3.5 font-bold">المستخدم</th>
                        <th className="p-3.5 font-bold">الدور</th>
                        <th className="p-3.5 font-bold">الحالة</th>
                        <th className="p-3.5 font-bold">تجاوزات فردية</th>
                        <th className="p-3.5 font-bold">آخر دخول</th>
                        <th className="p-3.5 font-bold text-center">إجراءات الإدارة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {users.map((u) => {
                        const overridesCount = Object.keys(u.overrides || {}).length;
                        const isSelf = u.id === userId;
                        const isLastAdmin = u.role === 'admin' && u.isActive && activeAdminCount <= 1;

                        return (
                          <tr key={u.id} className="hover:bg-surface-alt/50 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-ink-strong flex items-center gap-2">
                                <span>{u.fullName}</span>
                                {isSelf && <Badge variant="accent">أنت</Badge>}
                              </div>
                              <p className="text-xs text-ink-muted font-mono mt-0.5">{u.email || u.id.slice(0, 8)}</p>
                            </td>
                            <td className="p-3.5">
                              <Badge variant={u.role === 'admin' ? 'accent' : u.role === 'accountant' ? 'info' : 'default'}>
                                {ROLE_LABELS[u.role]}
                              </Badge>
                            </td>
                            <td className="p-3.5">
                              {u.isActive ? (
                                <Badge variant="success">نشط</Badge>
                              ) : (
                                <Badge variant="danger">موقوف</Badge>
                              )}
                            </td>
                            <td className="p-3.5">
                              {u.role === 'admin' ? (
                                <span className="text-xs text-ink-muted">صلاحية مطلقة دائمة</span>
                              ) : overridesCount > 0 ? (
                                <Badge variant="warning">{overridesCount} تخصيص</Badge>
                              ) : (
                                <span className="text-xs text-ink-muted">حسب الدور الافتراضي</span>
                              )}
                            </td>
                            <td className="p-3.5 text-xs text-ink-muted">
                              {u.lastLoginAt ? formatArabicDateTime(u.lastLoginAt) : 'لم يسجل بعد'}
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditUser(u)}
                                  title="تعديل الدور وكلمة المرور"
                                >
                                  <Edit3 strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                                  <span>تعديل</span>
                                </Button>

                                {u.role !== 'admin' && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openOverridesModal(u)}
                                    title="تخصيص صلاحيات فردية لهذا المستخدم"
                                  >
                                    <Sliders strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                                    <span>صلاحيات خاصة</span>
                                  </Button>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isLastAdmin && u.isActive}
                                  onClick={() => void handleToggleUserStatus(u)}
                                  title={
                                    isLastAdmin
                                      ? 'لا يمكن تعطيل آخر مدير نشط'
                                      : u.isActive
                                      ? 'إيقاف الحساب'
                                      : 'تفعيل الحساب'
                                  }
                                >
                                  {u.isActive ? (
                                    <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 text-warning" />
                                  ) : (
                                    <Unlock strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5 text-success" />
                                  )}
                                  <span>{u.isActive ? 'تعطيل' : 'تفعيل'}</span>
                                </Button>

                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={isSelf || isLastAdmin}
                                  onClick={() => setDeletingUser(u)}
                                  title={isSelf ? 'لا يمكنك حذف نفسك' : isLastAdmin ? 'لا يمكن حذف آخر مدير' : 'حذف المستخدم'}
                                >
                                  <Trash2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-info" />
                  <span>دعوات معلقة بانتظار أول دخول ({invitations.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl bg-surface-alt border border-line flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-ink-strong">{inv.full_name}</p>
                      <p className="text-ink-muted font-mono">{inv.email}</p>
                    </div>
                    <Badge variant="info">{ROLE_LABELS[normalizeRoleKey(inv.role)]}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* تبويب مصفوفة صلاحيات الأدوار */
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-ink-strong">تعديل صلاحيات دور:</span>
              {(['cashier', 'accountant'] as const).map((rk) => (
                <button
                  key={rk}
                  type="button"
                  onClick={() => setSelectedMatrixRole(rk)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    selectedMatrixRole === rk
                      ? 'bg-flame border-flame text-abyssal'
                      : 'bg-surface-alt border-line text-ink hover:bg-oatmeal/40'
                  }`}
                >
                  {ROLE_LABELS[rk]}
                </button>
              ))}
              <Badge variant="accent">مدير النظام (Admin) يمتلك كل الصلاحيات دائماً</Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleResetRoleToDefaults}>
                استرجاع الافتراضي
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSavingRoleMatrix}
                onClick={() => void handleSaveRolePermissions()}
              >
                حفظ صلاحيات {ROLE_LABELS[selectedMatrixRole]}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-5">
            {permissionGroups.map(([groupName, perms]) => (
              <div key={groupName} className="space-y-2.5">
                <h3 className="text-sm font-black text-ink-strong border-r-4 border-flame pr-2.5">{groupName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {perms.map((perm) => {
                    const checked = Boolean(roleMatrix[selectedMatrixRole]?.[perm.key]);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-flame/15 border-flame/60'
                            : 'bg-surface-alt border-line hover:bg-oatmeal/35'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleRolePerm(perm.key)}
                          className="mt-1 h-4 w-4 accent-flame cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink-strong">{perm.label}</p>
                          <p className="text-[11px] text-ink-muted leading-snug mt-0.5">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* مودال إنشاء مستخدم جديد */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="إضافة مستخدم جديد للمحل"
        description="أنشئ حساباً جديداً بكلمة مرور مؤقتة أو أرسل رابط دعوة"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="الاسم الكامل"
            placeholder="مثال: أحمد الكاشير"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Input
            label="البريد الإلكتروني"
            type="email"
            dir="ltr"
            placeholder="cashier@shop.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />

          <div className="space-y-1.5 text-right">
            <label className="block text-xs font-bold text-ink">الدور الوظيفي</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as RoleKey)}
              className="w-full h-11 px-3 rounded-xl border border-line bg-surface text-ink-strong text-sm focus:border-flame focus:outline-none"
            >
              <option value="cashier">{ROLE_LABELS.cashier}</option>
              <option value="accountant">{ROLE_LABELS.accountant}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
            </select>
          </div>

          <div className="space-y-2 text-right">
            <label className="block text-xs font-bold text-ink">طريقة التفعيل</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateMode('password')}
                className={`p-2.5 rounded-xl border text-xs font-bold ${
                  createMode === 'password'
                    ? 'bg-flame border-flame text-abyssal'
                    : 'bg-surface-alt border-line text-ink'
                }`}
              >
                كلمة مرور مؤقتة
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('invite')}
                className={`p-2.5 rounded-xl border text-xs font-bold ${
                  createMode === 'invite'
                    ? 'bg-flame border-flame text-abyssal'
                    : 'bg-surface-alt border-line text-ink'
                }`}
              >
                إرسال رابط دعوة
              </button>
            </div>
          </div>

          {createMode === 'password' && (
            <Input
              label="كلمة المرور المؤقتة (6 أحرف على الأقل)"
              type="text"
              dir="ltr"
              placeholder="******"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              required
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingCreate}>
              حفظ وإنشاء الحساب
            </Button>
          </div>
        </form>
      </Dialog>

      {/* مودال تعديل مستخدم وإعادة تعيين كلمة المرور */}
      <Dialog
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={`تعديل حساب: ${editingUser?.fullName || ''}`}
        maxWidth="md"
      >
        {editingUser && (
          <div className="space-y-4">
            <Input
              label="الاسم"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            <div className="space-y-1.5 text-right">
              <label className="block text-xs font-bold text-ink">الدور الوظيفي</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as RoleKey)}
                className="w-full h-11 px-3 rounded-xl border border-line bg-surface text-ink-strong text-sm focus:border-flame focus:outline-none"
              >
                <option value="cashier">{ROLE_LABELS.cashier}</option>
                <option value="accountant">{ROLE_LABELS.accountant}</option>
                <option value="admin">{ROLE_LABELS.admin}</option>
              </select>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-alt border border-line cursor-pointer">
              <span className="text-xs font-bold text-ink-strong">حالة الحساب نشط (مسموح بالدخول)</span>
              <input
                type="checkbox"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                className="h-4 w-4 accent-flame"
              />
            </label>

            <div className="p-3 rounded-xl bg-surface-alt border border-line space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-strong flex items-center gap-1.5">
                  <KeyRound strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-truffle dark:text-flame" />
                  <span>إعادة تعيين كلمة المرور</span>
                </span>
                {editingUser.email && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isSavingUser}
                    onClick={() => void handleSaveUserEdit(true)}
                  >
                    إرسال رابط للبريد
                  </Button>
                )}
              </div>
              <Input
                type="text"
                dir="ltr"
                placeholder="أدخل كلمة مرور جديدة مباشرة (اختياري)"
                value={resetPasswordInput}
                onChange={(e) => setResetPasswordInput(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isSavingUser}
                onClick={() => void handleSaveUserEdit(false)}
              >
                حفظ التعديلات
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* مودال التجاوزات الفردية للمستخدم */}
      <Dialog
        isOpen={Boolean(overrideUser)}
        onClose={() => setOverrideUser(null)}
        title={`الصلاحيات الخاصة: ${overrideUser?.fullName || ''}`}
        description="اختر (حسب الدور) أو (سماح خاص) أو (منع خاص) لكل صلاحية"
        maxWidth="2xl"
      >
        {overrideUser && (
          <div className="space-y-4">
            <div className="max-h-[58vh] overflow-y-auto space-y-4 pl-1">
              {permissionGroups.map(([groupName, perms]) => (
                <div key={groupName} className="space-y-2">
                  <h4 className="text-xs font-black text-ink-strong border-r-4 border-flame pr-2">{groupName}</h4>
                  <div className="space-y-1.5">
                    {perms.map((perm) => {
                      const state = draftOverrides[perm.key] || 'inherit';
                      const roleDefault = Boolean(roleMatrix[overrideUser.role]?.[perm.key]);
                      return (
                        <div
                          key={perm.key}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-alt border border-line text-xs"
                        >
                          <div>
                            <p className="font-bold text-ink-strong">{perm.label}</p>
                            <p className="text-[11px] text-ink-muted">
                              الافتراضي للدور: {roleDefault ? 'مسموح' : 'غير مسموح'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {(
                              [
                                { val: 'inherit', label: 'حسب الدور' },
                                { val: 'allow', label: 'سماح' },
                                { val: 'deny', label: 'منع' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() =>
                                  setDraftOverrides((prev) => ({ ...prev, [perm.key]: opt.val }))
                                }
                                className={`px-2.5 py-1 rounded-lg font-bold border text-[11px] transition-colors ${
                                  state === opt.val
                                    ? opt.val === 'allow'
                                      ? 'bg-success-bg border-success-border text-success'
                                      : opt.val === 'deny'
                                      ? 'bg-danger-bg border-danger-border text-danger-text'
                                      : 'bg-flame border-flame text-abyssal'
                                    : 'bg-surface border-line text-ink-muted hover:text-ink-strong'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="outline" onClick={() => setOverrideUser(null)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isSavingOverrides}
                onClick={() => void handleSaveOverrides()}
              >
                حفظ الصلاحيات الخاصة
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* مودال تأكيد الحذف */}
      <Dialog
        isOpen={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        title="تأكيد حذف المستخدم"
        maxWidth="sm"
      >
        {deletingUser && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-danger-bg border border-danger-border text-danger-text text-xs flex items-start gap-2">
              <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                هل أنت متأكد من حذف حساب <strong>{deletingUser.fullName}</strong>؟ سيتم منعه من الدخول نهائياً مع إبقاء سجل عملياته التاريخية في التقارير والتدقيق.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingUser(null)}>
                تراجع
              </Button>
              <Button variant="danger" isLoading={isDeletingUser} onClick={() => void handleDeleteUser()}>
                <XCircle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                <span>تأكيد الحذف</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
