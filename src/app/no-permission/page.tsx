'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowRight, Home } from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { getDefaultHomeRoute, ROLE_LABELS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function NoPermissionPage() {
  const { currentUserName, userRole, permissions, signOut, isAuthenticated } = useShop();
  const safeHome = getDefaultHomeRoute(permissions);

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-danger-border shadow-elevated text-center">
        <CardContent className="p-8 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-danger-bg border border-danger-border text-danger-text flex items-center justify-center mx-auto">
            <ShieldAlert strokeWidth={ICON_TOKENS.strokeWidth} className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="danger">غير مصرح بالوصول (403)</Badge>
            <h1 className="text-2xl font-black text-ink-strong">
              عفوًا، لا تملك صلاحية الدخول إلى هذه الصفحة
            </h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              حسابك الحالي (<strong className="text-ink-strong">{currentUserName}</strong> -{' '}
              <span className="font-bold">{ROLE_LABELS[userRole]}</span>) غير مخوّل لعرض هذا القسم أو تنفيذ هذه العملية. إذا كنت بحاجة إلى هذه الصلاحية، يرجى مراجعة مدير المحل.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {safeHome !== '/no-permission' ? (
              <Link href={safeHome}>
                <Button variant="primary" size="lg" className="gap-2">
                  <Home strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                  <span>العودة إلى صفحتي المتاحة</span>
                </Button>
              </Link>
            ) : null}

            {isAuthenticated && (
              <Button variant="outline" size="lg" onClick={() => void signOut()} className="gap-2">
                <ArrowRight strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                <span>تسجيل الدخول بحساب آخر</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
