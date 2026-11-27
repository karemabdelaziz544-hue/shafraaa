'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Lock, Mail, ShieldCheck, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useShop } from '@/lib/store/shop-store';
import { ICON_TOKENS } from '@/lib/design-tokens';

function LoginFormContent({ initialShopName }: { initialShopName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeFastLogin, shopName: storeShopName } = useShop();
  const displayShopName = storeShopName && storeShopName !== 'محل شفرة' ? storeShopName : initialShopName;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('deactivated') === '1') {
      setMessage({
        type: 'error',
        text: 'تم إيقاف هذا الحساب من قِبل مدير النظام ولا يمكنه الدخول.',
      });
    } else if (searchParams.get('timeout') === '1') {
      setMessage({
        type: 'error',
        text: 'انتهت مهلة الجلسة بسبب عدم النشاط. يرجى تسجيل الدخول مرة أخرى.',
      });
    } else if (searchParams.get('error') === 'signup_disabled') {
      setMessage({
        type: 'error',
        text: 'التسجيل العام معطّل. الحسابات يتم إنشاؤها من قِبل مدير النظام فقط.',
      });
    } else if (searchParams.get('error') === 'auth_callback_failed') {
      setMessage({
        type: 'error',
        text: 'تعذر التحقق من رابط الدخول أو انتهت صلاحيته. يرجى المحاولة مرة أخرى.',
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      router.replace('/');
      return;
    }

    try {
      if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'تعذر إرسال رابط استعادة كلمة المرور');
        }
        setMessage({ type: 'info', text: data.message });
        setMode('login');
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'بيانات الدخول غير صحيحة');
      }

      if (data.user && data.bootstrap) {
        await completeFastLogin({
          user: data.user,
          session: data.session || null,
          bootstrap: data.bootstrap,
        });
      }

      router.replace(data.redirectTo || '/');
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'تعذر إتمام الطلب',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 w-full">
      <Card className="max-w-md w-full shadow-elevated border-line">
        <CardHeader className="text-center pb-3 flex-col items-center bg-fantastic text-palladian border-b border-abyssal">
          <div className="w-14 h-14 rounded-2xl bg-flame text-abyssal flex items-center justify-center mx-auto mb-3 shadow-accent">
            {mode === 'reset' ? (
              <KeyRound strokeWidth={ICON_TOKENS.strokeWidth} className="w-8 h-8" />
            ) : (
              <ShieldCheck strokeWidth={ICON_TOKENS.strokeWidth} className="w-8 h-8" />
            )}
          </div>
          <CardTitle className="text-xl font-black text-palladian">
            {mode === 'reset' ? 'استعادة كلمة المرور عبر البريد' : `تسجيل دخول ${displayShopName}`}
          </CardTitle>
          <p className="text-xs text-oatmeal mt-1">
            لوحة إدارة المحل للتجزئة - مصر (EGP)
          </p>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold border flex items-start gap-2 ${
                  message.type === 'error'
                    ? 'bg-danger-bg border-danger-border text-danger-text'
                    : 'bg-info-bg border-info-border text-ink-strong'
                }`}
              >
                {message.type === 'error' && (
                  <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-ink block mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <Mail strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted absolute right-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="w-full h-11 pr-10 pl-3 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl text-left focus:outline-none focus:border-flame focus:ring-2 focus:ring-flame/25 disabled:opacity-60"
                  dir="ltr"
                />
              </div>
            </div>

            {mode === 'login' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-ink">كلمة المرور</label>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setMode('reset');
                      setMessage(null);
                    }}
                    className="text-[11px] font-bold text-danger-text dark:text-flame hover:underline disabled:opacity-50"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted absolute right-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full h-11 pr-10 pl-3 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl text-left focus:outline-none focus:border-flame focus:ring-2 focus:ring-flame/25 disabled:opacity-60"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              size="xl"
              variant="primary"
              isLoading={isLoading}
              className="w-full font-bold shadow-accent"
            >
              <LogIn strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 ml-2" />
              <span>
                {isLoading
                  ? mode === 'reset'
                    ? 'جاري إرسال الرابط...'
                    : 'جاري التحقق والدخول...'
                  : mode === 'reset'
                  ? 'إرسال رابط إعادة التعيين'
                  : 'دخول لوحة التحكم'}
              </span>
            </Button>

            {mode === 'reset' ? (
              <div className="text-center pt-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setMode('login');
                    setMessage(null);
                  }}
                  className="text-xs text-danger-text dark:text-flame hover:underline font-bold"
                >
                  العودة إلى تسجيل الدخول
                </button>
              </div>
            ) : (
              <p className="text-center text-[11px] text-ink-muted pt-1">
                الحسابات يتم إنشاؤها من قِبل مدير النظام فقط من داخل لوحة التحكم.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function LoginClient({ initialShopName }: { initialShopName: string }) {
  return (
    <Suspense fallback={null}>
      <LoginFormContent initialShopName={initialShopName} />
    </Suspense>
  );
}
