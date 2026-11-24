'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

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
      // في بيئة التطوير المحلية بدون إعداد مفاتيح Supabase
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
      <Card className="max-w-md w-full shadow-2xl border-slate-200">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-500/30">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-black text-slate-900">
            {isSignUp ? 'تسجيل حساب مستخدم / موظف جديد' : 'تسجيل دخول نظام شفرة'}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            لوحة إدارة المحل للتجزئة - مصر (EGP)
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border ${
                  message.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                {message.text}
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الاسم بالكامل</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="الاسم الثلاثي"
                  className="w-full h-11 px-3.5 text-sm border rounded-xl"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="w-full h-11 pr-10 pl-3 text-sm border rounded-xl text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className="w-full h-11 pr-10 pl-3 text-sm border rounded-xl text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">نوع الدور والصلاحية</label>
                <select
                  value={role}
                  onChange={(e: any) => setRole(e.target.value)}
                  className="w-full h-11 px-3 text-sm border rounded-xl"
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
              className="w-full font-bold shadow-md shadow-brand-500/20"
            >
              <LogIn className="w-5 h-5 ml-2" />
              <span>{isSignUp ? 'إنشاء الحساب' : 'دخول لوحة التحكم'}</span>
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setMessage(null);
                }}
                className="text-xs text-brand-600 hover:underline font-bold"
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
