'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'owner' | 'cashier'>('owner');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setTimeout(() => {
        setIsLoading(false);
        router.push('/');
      }, 300);
      return;
    }

    try {
      if (isSignUp) {
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined;
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName.trim() || 'مستخدم جديد',
              role,
            },
          },
        });
        if (error) throw error;
        setMessage({
          type: 'info',
          text: 'تم إنشاء الحساب بنجاح! تفقد بريدك الإلكتروني لتأكيد الحساب أو سجل الدخول الآن.',
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace('/');
        router.refresh();
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: `خطأ في المصادقة: ${err.message || 'بيانات الدخول غير صحيحة'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 w-full">
      <Card className="max-w-md w-full shadow-elevated border-line">
        <CardHeader className="text-center pb-3 flex-col items-center bg-fantastic text-palladian border-b border-abyssal">
          <div className="w-14 h-14 rounded-2xl bg-flame text-abyssal flex items-center justify-center mx-auto mb-3 shadow-accent">
            <ShieldCheck strokeWidth={ICON_TOKENS.strokeWidth} className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-black text-palladian">
            {isSignUp ? 'تسجيل حساب مستخدم / موظف جديد' : 'تسجيل دخول نظام شفرة'}
          </CardTitle>
          <p className="text-xs text-oatmeal mt-1">
            لوحة إدارة المحل للتجزئة - مصر (EGP)
          </p>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold border ${
                  message.type === 'error'
                    ? 'bg-danger-bg border-danger-border text-danger-text'
                    : 'bg-info-bg border-info-border text-ink-strong'
                }`}
              >
                {message.text}
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="text-xs font-bold text-ink block mb-1">الاسم بالكامل</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="الاسم الثلاثي"
                  className="w-full h-11 px-3.5 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl focus:outline-none focus:border-flame focus:ring-2 focus:ring-flame/25"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-ink block mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <Mail strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted absolute right-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="w-full h-11 pr-10 pl-3 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl text-left focus:outline-none focus:border-flame focus:ring-2 focus:ring-flame/25"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">كلمة المرور</label>
              <div className="relative">
                <Lock strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-ink-muted absolute right-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className="w-full h-11 pr-10 pl-3 text-sm border border-line bg-surface text-ink-strong placeholder:text-ink-muted rounded-xl text-left focus:outline-none focus:border-flame focus:ring-2 focus:ring-flame/25"
                  dir="ltr"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="text-xs font-bold text-ink block mb-1">نوع الدور والصلاحية</label>
                <select
                  value={role}
                  onChange={(e: any) => setRole(e.target.value)}
                  className="w-full h-11 px-3 text-sm border border-line bg-surface text-ink-strong rounded-xl focus:outline-none focus:border-flame"
                >
                  <option value="owner">المالك - صلاحيات كاملة</option>
                  <option value="cashier">كاشير - بيع وسداد فقط</option>
                </select>
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
              <span>{isSignUp ? 'إنشاء الحساب' : 'دخول لوحة التحكم'}</span>
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setMessage(null);
                }}
                className="text-xs text-truffle dark:text-flame hover:underline font-bold"
              >
                {isSignUp ? 'لديك حساب بالفعل؟ سجل دخولك' : 'إنشاء حساب محل أو مستخدم جديد'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
