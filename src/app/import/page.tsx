'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Eye,
  Check,
  XCircle,
  FileCheck2,
  Package,
  Users,
  Truck,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { useShop } from '@/lib/store/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  parseExcelWorkbook,
  generateProductsTemplate,
  generateCustomersTemplate,
  generateSuppliersTemplate,
  generateOpeningStockTemplate,
  generateShopTemplateWorkbook,
  SheetPreview,
  ValidatedImportResult,
} from '@/lib/excel-importer';

export default function ImportPage() {
  const { importDataFromExcel } = useShop();

  const [isLoading, setIsLoading] = useState(false);
  const [sheetPreviews, setSheetPreviews] = useState<SheetPreview[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // تحميل نماذج الإكسيل الجاهزة (الدمغات - Stamps)
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadProductsStamp = () => {
    downloadBlob(generateProductsTemplate(), 'فورمة_المنتجات_محل_شفرة.xlsx');
  };

  const handleDownloadCustomersStamp = () => {
    downloadBlob(generateCustomersTemplate(), 'فورمة_العملاء_محل_شفرة.xlsx');
  };

  const handleDownloadSuppliersStamp = () => {
    downloadBlob(generateSuppliersTemplate(), 'فورمة_الموردين_محل_شفرة.xlsx');
  };

  const handleDownloadOpeningStockStamp = () => {
    downloadBlob(generateOpeningStockTemplate(), 'فورمة_المخزون_الافتتاحي_محل_شفرة.xlsx');
  };

  const handleDownloadFullWorkbook = () => {
    downloadBlob(generateShopTemplateWorkbook(), 'دفتر_محل_شفرة_الشامل.xlsx');
  };

  // رفع ملف الإكسيل وقراءة الشيتات وتدقيق كل صف
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setSuccessMessage(null);
    try {
      const previews = await parseExcelWorkbook(file);
      setSheetPreviews(previews);
      setSelectedSheetIndex(0);
    } catch (err: any) {
      alert(`حدث خطأ أثناء فحص ملف الإكسيل: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // استيراد الصفوف الصالحة فقط من الشيت المحدد
  const handleImportValidRowsOnly = () => {
    if (sheetPreviews.length === 0) return;
    const current = sheetPreviews[selectedSheetIndex];
    const valResult = current.validationResult;
    if (!valResult || valResult.validCount === 0) {
      alert('لا توجد أي صفوف صالحة للاستيراد في هذا الشيت.');
      return;
    }

    importDataFromExcel(current.detectedEntity, valResult.validData);
    setSuccessMessage(
      `تم بنجاح استيراد ${valResult.validCount} صف صالح من شيت "${current.sheetName}"! ` +
        (valResult.invalidCount > 0
          ? `(تم استبعاد ${valResult.invalidCount} صف لوجود أخطاء بها).`
          : '')
    );
  };

  const currentPreview = sheetPreviews[selectedSheetIndex];
  const valResult: ValidatedImportResult | undefined = currentPreview?.validationResult;

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-brand-600" />
            <span>استيراد ملفات الإكسيل والدمغات النموذجية</span>
          </h1>
          <p className="text-xs text-slate-500">
            أهلًا يا كريم - حمل النموذج المطلوب ("الدمغة") برؤوس أعمدة ثابتة وبيانات توضيحية، ثم ارفعه للتدقيق والاستيراد
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadFullWorkbook}
          className="text-xs text-slate-700 gap-1.5"
        >
          <Download className="w-4 h-4 text-brand-600" />
          <span>تحميل الدفتر الكامل (شيتات مجمعة)</span>
        </Button>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* قسم تحميل قوالب ودمغات الإكسيل الثابتة (Stamps) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-brand-600" />
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            نماذج الإكسيل الثابتة الجاهزة للتحميل ("الدمغات"):
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* دمغة المنتجات */}
          <Card className="hover:border-brand-400 hover:shadow-md transition-all border-slate-200 bg-white">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">دمغة المنتجات</h4>
                  <p className="text-[10px] text-slate-400">اسم، باركود، تكلفة، بيع، مخزون</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                رؤوس أعمدة ثابتة بالعربية مع قيود البيانات وصف أمثلة لشواحن وكابلات وسماعات.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadProductsStamp}
                className="w-full text-xs font-bold gap-1.5 border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل نموذج المنتجات (.xlsx)</span>
              </Button>
            </CardContent>
          </Card>

          {/* دمغة العملاء */}
          <Card className="hover:border-emerald-400 hover:shadow-md transition-all border-slate-200 bg-white">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">دمغة العملاء</h4>
                  <p className="text-[10px] text-slate-400">اسم العميل، هاتف، حد ائتمان، رصيد</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                قالب مجهز لبيانات العملاء وأرقام هواتفهم وسقف المديونية والرصيد السابق.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCustomersStamp}
                className="w-full text-xs font-bold gap-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل نموذج العملاء (.xlsx)</span>
              </Button>
            </CardContent>
          </Card>

          {/* دمغة الموردين */}
          <Card className="hover:border-purple-400 hover:shadow-md transition-all border-slate-200 bg-white">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">دمغة الموردين</h4>
                  <p className="text-[10px] text-slate-400">اسم المورد، هاتف، رصيد مستحق</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                قالب تسجيل شركات التوريد والموردين وأرقام التواصل وأرصدة الديون المستحقة لهم.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSuppliersStamp}
                className="w-full text-xs font-bold gap-1.5 border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل نموذج الموردين (.xlsx)</span>
              </Button>
            </CardContent>
          </Card>

          {/* دمغة المخزون الافتتاحي */}
          <Card className="hover:border-amber-400 hover:shadow-md transition-all border-slate-200 bg-white">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">المخزون الافتتاحي</h4>
                  <p className="text-[10px] text-slate-400">باركود، صنف، كمية فعلية، تكلفة</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                قالب جرد رصيد أول المدة الفعلي لضبط أرصدة المحل عند بدء التشغيل مباشرة.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadOpeningStockStamp}
                className="w-full text-xs font-bold gap-1.5 border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-100"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل نموذج المخزون (.xlsx)</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* منطقة رفع ملف الإكسيل */}
      <Card className="border-dashed border-2 border-brand-300 bg-brand-50/20">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              ارفع ملف الإكسيل بعد تعبئة النموذج (.xlsx أو .xls)
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              يقوم النظام بفحص كل صف سطرًا بسطر وتمييز الصفوف الخاطئة بالأحمر مع إمكانية استيراد الصفوف الصالحة فقط.
            </p>
          </div>
          <input
            type="file"
            id="excel-file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label htmlFor="excel-file">
            <span className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm cursor-pointer shadow-md shadow-brand-500/20 transition-all active:scale-95">
              {isLoading ? 'جاري فحص وتدقيق البيانات...' : 'اختيار واستعراض الملف'}
            </span>
          </label>
        </CardContent>
      </Card>

      {/* عرض نتائج الفحص والمعاينة وتدقيق الصفوف */}
      {sheetPreviews.length > 0 && currentPreview && valResult && (
        <div className="space-y-4">
          {/* تبويبات الشيتات */}
          {sheetPreviews.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {sheetPreviews.map((preview, idx) => (
                <button
                  key={preview.sheetName}
                  onClick={() => setSelectedSheetIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all flex items-center gap-2 ${
                    selectedSheetIndex === idx
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{preview.sheetName}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">
                    {preview.rowCount} سطر
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* لوحة نتائج الفحص الصارمة */}
          <Card className="border-slate-300">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-slate-50/70 py-3.5">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span>تقرير فحص وتدقيق شيت: {currentPreview.sheetName}</span>
                  <Badge variant="purple">النوع: {currentPreview.detectedEntity}</Badge>
                </CardTitle>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-slate-600">
                    الإجمالي: <b className="text-slate-900">{valResult.totalRows}</b> صف
                  </span>
                  <span className="text-emerald-700 font-bold">
                    ✓ صالح: {valResult.validCount} صف
                  </span>
                  {valResult.invalidCount > 0 && (
                    <span className="text-rose-700 font-bold">
                      ✕ به أخطاء: {valResult.invalidCount} صف
                    </span>
                  )}
                </div>
              </div>

              {/* زر استيراد الصفوف الصالحة فقط */}
              <Button
                variant="primary"
                size="md"
                disabled={valResult.validCount === 0}
                onClick={handleImportValidRowsOnly}
                className="font-bold gap-2 shadow-md shadow-brand-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  استيراد الصفوف الصالحة فقط ({valResult.validCount} صف)
                </span>
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* إشعار حالة التدقيق */}
              {valResult.invalidCount > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      تم اكتشاف {valResult.invalidCount} صف يحتوي على أخطاء!
                    </span>
                    <span className="text-amber-800">
                      تم تظليل الصفوف غير الصالحة باللون الأحمر مع بيان سبب الخطأ. بالضغط على &quot;استيراد الصفوف الصالحة فقط&quot; سيتم حفظ الصفوف السليمة ({valResult.validCount} صف) وتخطي الصفوف الخاطئة بأمان.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">
                    جميع الصفوف ({valResult.validCount} صف) سليمة وتطابق الشروط وجاهزة للاستيراد الفوري!
                  </span>
                </div>
              )}

              {/* جدول تدقيق الصفوف مع التظليل للأخطاء */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 font-bold border-b text-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="p-3">رقم السطر</th>
                        <th className="p-3">الحالة والتدقيق</th>
                        <th className="p-3">أسباب الخطأ</th>
                        {currentPreview.columns.slice(0, 5).map((col) => (
                          <th key={col} className="p-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {valResult.rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={`transition-colors ${
                            row.isValid
                              ? 'bg-white hover:bg-emerald-50/30'
                              : 'bg-rose-50/80 hover:bg-rose-100/70 border-l-4 border-rose-500'
                          }`}
                        >
                          <td className="p-3 font-mono font-bold text-slate-700">
                            سطر {row.rowIndex}
                          </td>
                          <td className="p-3">
                            {row.isValid ? (
                              <Badge variant="success" className="text-[11px] gap-1">
                                <Check className="w-3 h-3" />
                                <span>صالح للاستيراد</span>
                              </Badge>
                            ) : (
                              <Badge variant="danger" className="text-[11px] gap-1">
                                <XCircle className="w-3 h-3" />
                                <span>غير صالح</span>
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {row.errors.length > 0 ? (
                              <ul className="text-rose-700 font-bold text-[11px] list-disc list-inside space-y-0.5">
                                {row.errors.map((err, errIdx) => (
                                  <li key={errIdx}>{err}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-emerald-600 font-medium text-[11px]">
                                البيانات مستوفية للشروط
                              </span>
                            )}
                          </td>
                          {currentPreview.columns.slice(0, 5).map((col) => (
                            <td key={col} className="p-3 text-slate-800 font-medium">
                              {row.originalRow[col] !== undefined && row.originalRow[col] !== null
                                ? String(row.originalRow[col])
                                : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
