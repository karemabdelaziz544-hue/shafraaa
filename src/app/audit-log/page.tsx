'use client';

import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  Search,
  Calendar,
  User,
  Filter,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { ROLE_LABELS, normalizeRoleKey } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { formatArabicDateTime } from '@/lib/formatters';
import { ICON_TOKENS } from '@/lib/design-tokens';

const ACTION_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent' }> = {
  CREATE: { label: 'إنشاء', variant: 'success' },
  UPDATE: { label: 'تعديل', variant: 'info' },
  DELETE: { label: 'حذف', variant: 'danger' },
  RETURN: { label: 'مرتجع', variant: 'warning' },
  PAYMENT: { label: 'سداد / تحصيل', variant: 'accent' },
  OPEN: { label: 'فتح درج', variant: 'success' },
  CLOSE: { label: 'إغلاق درج', variant: 'warning' },
  REOPEN: { label: 'إعادة فتح درج', variant: 'danger' },
  LOGIN: { label: 'تسجيل دخول', variant: 'info' },
  USER_CREATE: { label: 'إضافة مستخدم', variant: 'success' },
  USER_UPDATE: { label: 'تعديل مستخدم', variant: 'info' },
  USER_DELETE: { label: 'حذف مستخدم', variant: 'danger' },
  ROLE_PERMISSIONS_UPDATE: { label: 'تعديل الصلاحيات', variant: 'accent' },
  SETTINGS_UPDATE: { label: 'تعديل الإعدادات', variant: 'info' },
  DAMAGE: { label: 'هالك / تالف', variant: 'danger' },
  IMPORT: { label: 'استيراد إكسيل', variant: 'accent' },
  APPROVE: { label: 'اعتماد جرد', variant: 'success' },
  WITHDRAWAL: { label: 'سحب مالك', variant: 'warning' },
};

export default function AuditLogPage() {
  const { auditLogs, isInitialLoading } = useShop();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const uniqueActors = useMemo(() => {
    const map = new Map<string, string>();
    auditLogs.forEach((l) => {
      const key = l.changedBy || l.actorName || '';
      const label = l.actorName || (l.changedBy ? `مستخدم (${l.changedBy.slice(0, 6)})` : 'النظام');
      if (key) map.set(key, label);
    });
    return Array.from(map.entries());
  }, [auditLogs]);

  const filteredLogs = auditLogs.filter((log) => {
    if (selectedUser !== 'all') {
      const key = log.changedBy || log.actorName || '';
      if (key !== selectedUser) return false;
    }
    if (selectedAction !== 'all' && log.action !== selectedAction) return false;
    const logDate = log.createdAt.slice(0, 10);
    if (dateFrom && logDate < dateFrom) return false;
    if (dateTo && logDate > dateTo) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.details.toLowerCase().includes(q) ||
        log.tableName.toLowerCase().includes(q) ||
        (log.actorName && log.actorName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <ClipboardList strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>سجل التدقيق والمراقبة (Audit Log)</span>
          </h1>
          <p className="text-xs text-ink-muted">
            توثيق كامل غير قابل للتعديل لكل عملية في المحل (من قام بها، ما هي، ومتى) مع الفلترة بالمستخدم والتاريخ
          </p>
        </div>
        <Badge variant="info">{filteredLogs.length} سجل</Badge>
      </div>

      {/* شريط الفلاتر */}
      <div className="bg-surface p-3.5 rounded-2xl border border-line grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث في التفاصيل أو القسم أو المستخدم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pr-9 pl-3 text-xs border border-line bg-surface-alt text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <User strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted shrink-0" />
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full h-10 px-2.5 text-xs border border-line bg-surface-alt text-ink-strong rounded-xl focus:outline-none focus:border-flame"
          >
            <option value="all">جميع المستخدمين</option>
            {uniqueActors.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Filter strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted shrink-0" />
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full h-10 px-2.5 text-xs border border-line bg-surface-alt text-ink-strong rounded-xl focus:outline-none focus:border-flame"
          >
            <option value="all">جميع العمليات</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Calendar strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="من تاريخ"
            className="w-1/2 h-10 px-2 text-[11px] border border-line bg-surface-alt text-ink-strong rounded-xl focus:outline-none focus:border-flame"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="إلى تاريخ"
            className="w-1/2 h-10 px-2 text-[11px] border border-line bg-surface-alt text-ink-strong rounded-xl focus:outline-none focus:border-flame"
          />
        </div>
      </div>

      {/* جدول السجل */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isInitialLoading ? (
            <TableSkeletonRows columns={5} rows={7} />
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-ink-muted text-sm">
              لا توجد سجلات مطابقة لمعايير التصفية.
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-surface-alt text-ink font-bold border-b border-line">
                <tr>
                  <th className="p-3 sm:p-4">التاريخ والوقت</th>
                  <th className="p-3 sm:p-4">المستخدم</th>
                  <th className="p-3 sm:p-4">نوع العملية</th>
                  <th className="p-3 sm:p-4">القسم / الجدول</th>
                  <th className="p-3 sm:p-4">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filteredLogs.map((log) => {
                  const meta = ACTION_LABELS[log.action] || { label: log.action, variant: 'default' as const };
                  const actorRoleLabel = log.actorRole
                    ? ROLE_LABELS[normalizeRoleKey(log.actorRole)]
                    : null;

                  return (
                    <tr key={log.id} className="hover:bg-surface-alt/60 transition-colors">
                      <td className="p-3 sm:p-4 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                        {formatArabicDateTime(log.createdAt)}
                      </td>
                      <td className="p-3 sm:p-4">
                        <p className="font-bold text-ink-strong text-xs">
                          {log.actorName || (log.changedBy ? `مستخدم (${log.changedBy.slice(0, 6)})` : 'النظام')}
                        </p>
                        {actorRoleLabel && (
                          <span className="text-[10px] text-ink-muted">{actorRoleLabel}</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4">
                        <Badge variant={meta.variant} className="text-[11px]">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-xs text-ink-muted">
                        {log.tableName}
                      </td>
                      <td className="p-3 sm:p-4 text-xs text-ink-strong leading-relaxed">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
