'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  Database,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Key,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  Clock,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { useTheme } from '@/components/layout/theme-provider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function SettingsPage() {
  const {
    shopId,
    shopName,
    ownerName,
    userEmail,
    userRole,
    isSupabaseConfigured,
    cloudStatus,
    cloudError,
    refreshFromCloud,
    exportDatabaseJSON,
    restoreDatabaseJSON,
    resetToSampleData,
    can,
    sessionTimeoutMinutes,
    updateSessionTimeout,
    updateShopName,
  } = useShop();
  const { theme, setTheme } = useTheme();

  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const [shopNameInput, setShopNameInput] = useState(shopName);
  const [isSavingShopName, setIsSavingShopName] = useState(false);
  const [shopNameMsg, setShopNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [timeoutInput, setTimeoutInput] = useState<number>(sessionTimeoutMinutes || 60);
  const [isSavingTimeout, setIsSavingTimeout] = useState(false);
  const [timeoutMsg, setTimeoutMsg] = useState<string | null>(null);

  useEffect(() => {
    setShopNameInput(shopName);
  }, [shopName]);

  const handleSaveShopName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingShopName(true);
    setShopNameMsg(null);
    const res = await updateShopName(shopNameInput);
    setShopNameMsg({
      ok: res.ok,
      text: res.ok ? 'تم تحديث اسم المحل بنجاح في جميع الشاشات والفواتير!' : res.error || 'تعذر حفظ اسم المحل',
    });
    setIsSavingShopName(false);
  };

  const handleSaveTimeout = async () => {
    setIsSavingTimeout(true);
    setTimeoutMsg(null);
    const res = await updateSessionTimeout(timeoutInput);
    setTimeoutMsg(res.ok ? 'تم تحديث مهلة إغلاق الجلسة بنجاح!' : res.error || 'تعذر تحديث المهلة');
    setIsSavingTimeout(false);
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_${shopName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = restoreDatabaseJSON(content);
      if (success) {
        setRestoreStatus('تمت استعادة النسخة الاحتياطية وتحديث بيانات المحل بنجاح!');
      } else {
        setRestoreStatus('فشل في قراءة ملف النسخة الاحتياطية. يرجى التأكد من صحة الملف.');
      }
    };
    reader.readAsText(file);
  };

  const handleCheckConnection = async () => {
    setIsCheckingCloud(true);
    await refreshFromCloud();
    setIsCheckingCloud(false);
  };

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-line">
        <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
          <Settings strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
          <span>إعدادات المحل والنسخ الاحتياطي</span>
        </h1>
        <p className="text-xs text-ink-muted">
          أهلًا يا {ownerName} - إدارة بيانات المنشأة، مظهر النظام، حفظ نسخ الأمان الاحتياطية، وحالة الاتصال الفعلية
        </p>
      </div>

      {restoreStatus && (
        <div className="p-4 bg-success-bg border border-success-border rounded-2xl text-success text-sm font-bold flex items-center gap-2">
          <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-success" />
          <span>{restoreStatus}</span>
        </div>
      )}

      {/* بيانات المحل والمالك */}
      <Card>
        <CardHeader>
          <CardTitle>بيانات المحل وهوية المالك</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <span className="text-ink-muted block mb-1.5">اسم المحل:</span>
              {userRole === 'admin' ? (
                <form onSubmit={handleSaveShopName} className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={shopNameInput}
                      onChange={(e) => setShopNameInput(e.target.value)}
                      placeholder="اسم المحل الرسمي"
                      className="flex-1 h-10 px-3.5 rounded-xl border border-line bg-surface text-ink-strong text-sm font-bold focus:outline-none focus:border-flame focus:ring-2 focus:ring-flame/25"
                    />
                    <Button type="submit" variant="primary" size="md" isLoading={isSavingShopName}>
                      حفظ اسم المحل
                    </Button>
                  </div>
                  {shopNameMsg && (
                    <p className={`text-xs font-bold ${shopNameMsg.ok ? 'text-success' : 'text-danger-text'}`}>
                      {shopNameMsg.text}
                    </p>
                  )}
                </form>
              ) : (
                <p className="font-bold text-base text-ink-strong">{shopName}</p>
              )}
            </div>
            <div>
              <span className="text-ink-muted block mb-1">المستخدم المسؤول:</span>
              <p className="font-bold text-base text-ink-strong">
                {ownerName} {userEmail ? `(${userEmail})` : ''}
              </p>
            </div>
            <div>
              <span className="text-ink-muted block mb-1">العملة الأساسية:</span>
              <p className="font-bold text-base text-ink-strong">الجنيه المصري (EGP / ج.م)</p>
            </div>
            <div>
              <span className="text-ink-muted block mb-1">معرف المتجر (Shop ID):</span>
              <p className="font-mono text-xs text-ink" dir="ltr">
                {shopId || 'وضع محلي (بدون معرف سحابي)'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* مظهر الواجهة (الوضع الفاتح / الوضع الداكن) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-flame" />
            ) : (
              <Sun strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-truffle" />
            )}
            <span>مظهر النظام وألوان العرض</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-4 rounded-2xl border text-right transition-colors flex items-center justify-between ${
                theme === 'light'
                  ? 'bg-flame/20 border-flame text-ink-strong font-bold'
                  : 'bg-surface-alt border-line text-ink hover:bg-oatmeal/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-truffle dark:text-flame" />
                <div>
                  <p className="text-sm font-bold text-ink-strong">الوضع الفاتح (Palladian)</p>
                  <p className="text-xs text-ink-muted">خلفية دافئة مريحة للعين للاستخدام النهاري</p>
                </div>
              </div>
              {theme === 'light' && <Badge variant="accent">مفعل</Badge>}
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-2xl border text-right transition-colors flex items-center justify-between ${
                theme === 'dark'
                  ? 'bg-flame/20 border-flame text-ink-strong font-bold'
                  : 'bg-surface-alt border-line text-ink hover:bg-oatmeal/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-fantastic dark:text-flame" />
                <div>
                  <p className="text-sm font-bold text-ink-strong">الوضع الداكن (Abyssal Blue)</p>
                  <p className="text-xs text-ink-muted">تباين عالٍ مريح للإضاءة الخافتة والمساء</p>
                </div>
              </div>
              {theme === 'dark' && <Badge variant="accent">مفعل</Badge>}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* حالة الاتصال الفعلية بقاعدة بيانات Supabase */}
      <Card className={cloudStatus === 'error' ? 'border-danger-border' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between w-full">
            <span className="flex items-center gap-2">
              <Key
                strokeWidth={ICON_TOKENS.strokeWidth}
                className={`w-5 h-5 ${
                  cloudStatus === 'connected'
                    ? 'text-success'
                    : cloudStatus === 'error'
                    ? 'text-danger-text'
                    : 'text-ink-muted'
                }`}
              />
              <span>حالة تكامل Supabase السحابي</span>
            </span>
            {isSupabaseConfigured && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckConnection}
                isLoading={isCheckingCloud}
                className="gap-1.5 text-xs"
              >
                <RefreshCw strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                <span>فحص الاتصال الآن</span>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${
              cloudStatus === 'connected'
                ? 'bg-success-bg border-success-border'
                : cloudStatus === 'error'
                ? 'bg-danger-bg border-danger-border'
                : 'bg-surface-alt border-line'
            }`}
          >
            <div>
              <p className="text-xs font-bold text-ink-strong">حالة الاتصال الفعلية بقاعدة البيانات:</p>
              <p
                className={`text-[11px] mt-0.5 ${
                  cloudStatus === 'error' ? 'text-danger-text font-semibold' : 'text-ink-muted'
                }`}
              >
                {cloudStatus === 'connected'
                  ? `متصل سحابيًا بنجاح وتم التحقق من قراءة جداول المتجر (${shopName})`
                  : cloudStatus === 'error'
                  ? cloudError || 'فشلت القراءة من قاعدة البيانات (تأكد من صلاحيات GRANT و RLS وربط الحساب بمتجر)'
                  : 'يعمل التطبيق حاليًا في وضع التخزين المحلي (لم يتم إعداد مفاتيح Supabase)'}
              </p>
            </div>
            <Badge
              variant={
                cloudStatus === 'connected'
                  ? 'success'
                  : cloudStatus === 'error'
                  ? 'danger'
                  : 'default'
              }
              className="shrink-0"
            >
              {cloudStatus === 'connected'
                ? 'متصل ومفعل'
                : cloudStatus === 'error'
                ? 'فشل الاتصال بالبيانات'
                : 'تخزين محلي نشط'}
            </Badge>
          </div>

          {cloudStatus === 'error' && (
            <div className="p-3 bg-warning-bg border border-warning-border rounded-xl text-xs text-warning flex items-start gap-2">
              <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <span>
                يرجى تشغيل ملف الميجريشن <code className="font-mono font-bold">20261125_000005_fix_grants_rls_and_returns.sql</code> في Supabase SQL Editor لمنح صلاحيات الجداول لدور <code className="font-mono">authenticated</code> وتصحيح سياسات RLS.
              </span>
            </div>
          )}

          <p className="text-[11px] text-ink-muted">
            ملفات التهجرة SQL موجودة في مجلد <code className="font-mono bg-surface-alt border border-line px-1 py-0.5 rounded">supabase/migrations</code> لتشغيلها مباشرة في لوحة Supabase الخاصة بك.
          </p>
        </CardContent>
      </Card>

      {/* أمان الجلسة ومهلة عدم النشاط */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-truffle dark:text-flame" />
            <span>أمان الجلسة والتسجيل التلقائي (Session Timeout)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-ink-muted leading-relaxed">
            يتم تسجيل خروج المستخدم تلقائياً عند ترك النظام دون حركة أو نشاط لمدة تتجاوز المهلة المحددة لحماية بيانات المحل.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={timeoutInput}
              disabled={!can('settings.manage')}
              onChange={(e) => setTimeoutInput(parseInt(e.target.value, 10) || 60)}
              className="h-10 px-3 text-sm border border-line rounded-xl bg-surface text-ink-strong font-bold focus:outline-none focus:border-flame disabled:opacity-60"
            >
              <option value={15}>15 دقيقة</option>
              <option value={30}>30 دقيقة</option>
              <option value={60}>ساعة واحدة (60 دقيقة)</option>
              <option value={120}>ساعتان (120 دقيقة)</option>
              <option value={240}>4 ساعات</option>
              <option value={480}>8 ساعات (وردية كاملة)</option>
            </select>
            {can('settings.manage') && (
              <Button
                variant="primary"
                size="md"
                isLoading={isSavingTimeout}
                onClick={() => void handleSaveTimeout()}
              >
                حفظ مهلة الجلسة
              </Button>
            )}
          </div>
          {timeoutMsg && (
            <p className="text-xs font-bold text-success">{timeoutMsg}</p>
          )}
        </CardContent>
      </Card>

      {/* إدارة النسخ الاحتياطي الكامل وقواعد البيانات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-truffle dark:text-flame" />
            <span>النسخ الاحتياطي الكامل لقاعدة البيانات</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-ink-muted leading-relaxed">
            يمكنك تنزيل نسخة احتياطية بجميع الأصناف، الفواتير، ديون العملاء، الموردين، وجلسات الدرج في أي وقت، واستعادتها لحماية تجارتك.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {can('export.data') && (
              <Button variant="primary" size="lg" onClick={handleDownloadBackup} className="gap-2">
                <Download strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                <span>تنزيل نسخة احتياطية كاملة (JSON)</span>
              </Button>
            )}

            {!isSupabaseConfigured && can('settings.manage') && (
              <>
                <input
                  type="file"
                  id="restore-file"
                  accept=".json"
                  onChange={handleRestoreBackup}
                  className="hidden"
                />
                <label htmlFor="restore-file">
                  <span className="inline-flex items-center justify-center h-12 px-6 rounded-xl border border-line bg-surface hover:bg-surface-alt text-ink font-semibold text-sm cursor-pointer transition-colors gap-2">
                    <Upload strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                    <span>استعادة من ملف نسخة احتياطية</span>
                  </span>
                </label>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (confirm('هل أنت متأكد من إعادة تعيين البيانات للوضع النموذجي الافتراضي؟')) {
                      resetToSampleData();
                    }
                  }}
                  className="text-danger-text border-danger-border hover:bg-danger-bg mr-auto"
                >
                  <RotateCcw strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 ml-1" />
                  <span>إعادة ضبط البيانات النموذجية</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
