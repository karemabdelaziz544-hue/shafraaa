'use client';

import React, { useState } from 'react';
import {
  Settings,
  Database,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const {
    shopName,
    ownerName,
    products,
    customers,
    suppliers,
    salesInvoices,
    exportDatabaseJSON,
    restoreDatabaseJSON,
    resetToSampleData,
  } = useShop();

  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

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

  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-600" />
          <span>إعدادات المحل والنسخ الاحتياطي</span>
        </h1>
        <p className="text-xs text-slate-500">
          أهلًا يا كريم - إدارة بيانات المنشأة، حفظ نسخ الأمان الاحتياطية، وحالة الاتصال
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
              <span className="text-slate-500 block mb-1">المالك المسؤول:</span>
              <p className="font-bold text-base text-slate-900">{ownerName}</p>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">العملة الأساسية:</span>
              <p className="font-bold text-base text-slate-900">الجنيه المصري (EGP / ج.م)</p>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">الاتجاه واللغة:</span>
              <p className="font-bold text-base text-slate-900">العربية (RTL) - خط Cairo</p>
            </div>
          </div>
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
            يمكنك تنزيل نسخة احتياطية مشفرة بجميع الأصناف، الفواتير، ديون العملاء، الموردين، وجلسات الدرج في أي وقت، واستعادتها بضغطة زر واحدة لحماية تجارتك.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="primary" size="lg" onClick={handleDownloadBackup} className="gap-2">
              <Download className="w-4 h-4" />
              <span>تنزيل نسخة احتياطية كاملة (JSON)</span>
            </Button>

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
          </div>
        </CardContent>
      </Card>

      {/* حالة الاتصال بقاعدة بيانات Supabase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-600" />
            <span>حالة تكامل Supabase السحابي</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-900">اتصال Supabase المباشر:</p>
              <p className="text-[11px] text-slate-500">
                {isSupabaseConfigured
                  ? 'تم ربط المفاتيح بنجاح من متغيرات البيئة .env'
                  : 'يعمل التطبيق حاليًا في وضع التخزين المحلي الآمن (Offline-First)'}
              </p>
            </div>
            <Badge variant={isSupabaseConfigured ? 'success' : 'default'}>
              {isSupabaseConfigured ? 'متصل سحابيًا' : 'تخزين محلي نشط'}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400">
            ملفات التهجرة SQL موجودة في مجلد <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">supabase/migrations</code> لتشغيلها مباشرة في لوحة Supabase الخاصة بك.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
