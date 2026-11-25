'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const {
    shopId,
    shopName,
    ownerName,
    userEmail,
    isSupabaseConfigured,
    cloudStatus,
    cloudError,
    refreshFromCloud,
    exportDatabaseJSON,
    restoreDatabaseJSON,
    resetToSampleData,
  } = useShop();

  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);

  // تحميل النسخة الاحتياطية الكاملة بصيغة JSON
  const handleDownloadBackup = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_محل_شفرة_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // استعادة نسخة احتياطية من ملف JSON
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
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-600" />
          <span>إعدادات المحل والنسخ الاحتياطي</span>
        </h1>
        <p className="text-xs text-slate-500">
          أهلًا يا {ownerName} - إدارة بيانات المنشأة، حفظ نسخ الأمان الاحتياطية، وحالة الاتصال الفعلية
        </p>
      </div>

      {restoreStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
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
            <div>
              <span className="text-slate-500 block mb-1">اسم المحل:</span>
              <p className="font-bold text-base text-slate-900">{shopName}</p>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">المستخدم المسؤول:</span>
              <p className="font-bold text-base text-slate-900">
                {ownerName} {userEmail ? `(${userEmail})` : ''}
              </p>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">العملة الأساسية:</span>
              <p className="font-bold text-base text-slate-900">الجنيه المصري (EGP / ج.م)</p>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">معرف المتجر (Shop ID):</span>
              <p className="font-mono text-xs text-slate-700" dir="ltr">
                {shopId || 'وضع محلي (بدون معرف سحابي)'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* حالة الاتصال الفعلية بقاعدة بيانات Supabase */}
      <Card className={cloudStatus === 'error' ? 'border-rose-300' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between w-full">
            <span className="flex items-center gap-2">
              <Key className={`w-5 h-5 ${cloudStatus === 'connected' ? 'text-emerald-600' : cloudStatus === 'error' ? 'text-rose-600' : 'text-slate-500'}`} />
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
                <RefreshCw className="w-3.5 h-3.5" />
                <span>فحص الاتصال الآن</span>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${
              cloudStatus === 'connected'
                ? 'bg-emerald-50/70 border-emerald-200'
                : cloudStatus === 'error'
                ? 'bg-rose-50 border-rose-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <p className="text-xs font-bold text-slate-900">حالة الاتصال الفعلية بقاعدة البيانات:</p>
              <p
                className={`text-[11px] mt-0.5 ${
                  cloudStatus === 'error' ? 'text-rose-800 font-semibold' : 'text-slate-600'
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
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                يرجى تشغيل ملف الميجريشن <code className="font-mono font-bold">20261125_000005_fix_grants_rls_and_returns.sql</code> في Supabase SQL Editor لمنح صلاحيات الجداول لدور <code className="font-mono">authenticated</code> وتصحيح سياسات RLS.
              </span>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            ملفات التهجرة SQL موجودة في مجلد <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">supabase/migrations</code> لتشغيلها مباشرة في لوحة Supabase الخاصة بك.
          </p>
        </CardContent>
      </Card>

      {/* إدارة النسخ الاحتياطي الكامل وقواعد البيانات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-600" />
            <span>النسخ الاحتياطي الكامل لقاعدة البيانات</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            يمكنك تنزيل نسخة احتياطية بجميع الأصناف، الفواتير، ديون العملاء، الموردين، وجلسات الدرج في أي وقت، واستعادتها لحماية تجارتك.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="primary" size="lg" onClick={handleDownloadBackup} className="gap-2">
              <Download className="w-4 h-4" />
              <span>تنزيل نسخة احتياطية كاملة (JSON)</span>
            </Button>

            {!isSupabaseConfigured && (
              <>
                <input
                  type="file"
                  id="restore-file"
                  accept=".json"
                  onChange={handleRestoreBackup}
                  className="hidden"
                />
                <label htmlFor="restore-file">
                  <span className="inline-flex items-center justify-center h-12 px-6 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm cursor-pointer transition-all gap-2">
                    <Upload className="w-4 h-4" />
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
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 mr-auto"
                >
                  <RotateCcw className="w-4 h-4 ml-1" />
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
