'use client';

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Check,
  XCircle,
  FileCheck2,
  Package,
  Users,
  Truck,
  Boxes,
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
import { ICON_TOKENS } from '@/lib/design-tokens';

export default function ImportPage() {
  const { importDataFromExcel, can } = useShop();

  const [isLoading, setIsLoading] = useState(false);
  const [sheetPreviews, setSheetPreviews] = useState<SheetPreview[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleImportValidRowsOnly = async () => {
    if (sheetPreviews.length === 0) return;
    const current = sheetPreviews[selectedSheetIndex];
    const valResult = current.validationResult;
    if (!valResult || valResult.validCount === 0) {
      alert('لا توجد أي صفوف صالحة للاستيراد في هذا الشيت.');
      return;
    }

    const res = await importDataFromExcel(current.detectedEntity, valResult.validData);
    if (!res.ok) {
      alert(res.error || 'تعذر حفظ البيانات المستوردة في قاعدة البيانات');
      return;
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-strong flex items-center gap-2">
            <FileSpreadsheet strokeWidth={ICON_TOKENS.strokeWidth} className="w-6 h-6 text-truffle dark:text-flame" />
            <span>استيراد ملفات الإكسيل والدمغات النموذجية</span>
          </h1>
          <p className="text-xs text-ink-muted">
            أهلًا يا كريم - حمل النموذج المطلوب (&quot;الدمغة&quot;) برؤوس أعمدة ثابتة وبيانات توضيحية، ثم ارفعه للتدقيق والاستيراد
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadFullWorkbook}
          className="text-xs text-ink gap-1.5"
        >
          <Download strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-truffle dark:text-flame" />
          <span>تحميل الدفتر الكامل (شيتات مجمعة)</span>
        </Button>
      </div>

      {successMessage && (
        <div className="p-4 bg-success-bg border border-success-border rounded-2xl text-success text-sm font-bold flex items-center gap-2">
          <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-success shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* قسم تحميل قوالب ودمغات الإكسيل الثابتة */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileCheck2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5 text-truffle dark:text-flame" />
          <h3 className="text-sm sm:text-base font-black text-ink-strong">
            نماذج الإكسيل الثابتة الجاهزة للتحميل (&quot;الدمغات&quot;):
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* دمغة المنتجات */}
          <Card className="hover:border-flame transition-colors border-line bg-surface">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-fantastic text-palladian flex items-center justify-center font-bold">
                  <Package strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink-strong">دمغة المنتجات</h4>
                  <p className="text-[10px] text-ink-muted">اسم، باركود، تكلفة، بيع، مخزون</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                رؤوس أعمدة ثابتة بالعربية مع قيود البيانات وصف أمثلة لشواحن وكابلات وسماعات.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadProductsStamp}
                className="w-full text-xs font-bold gap-1.5 bg-surface-alt hover:bg-flame hover:text-abyssal hover:border-flame"
              >
                <Download strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                <span>تحميل نموذج المنتجات (.xlsx)</span>
              </Button>
            </CardContent>
          </Card>

          {/* دمغة العملاء */}
          <Card className="hover:border-success-border transition-colors border-line bg-surface">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-success-bg text-success flex items-center justify-center font-bold">
                  <Users strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink-strong">دمغة العملاء</h4>
                  <p className="text-[10px] text-ink-muted">اسم العميل، هاتف، حد ائتمان، رصيد</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                قالب مجهز لبيانات العملاء وأرقام هواتفهم وسقف المديونية والرصيد السابق.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCustomersStamp}
                className="w-full text-xs font-bold gap-1.5 border-success-border text-success bg-success-bg/50 hover:bg-success-bg"
              >
                <Download strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                <span>تحميل نموذج العملاء (.xlsx)</span>
              </Button>
            </CardContent>
          </Card>

          {/* دمغة الموردين */}
          <Card className="hover:border-flame transition-colors border-line bg-surface">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-flame/25 text-abyssal dark:text-flame flex items-center justify-center font-bold">
                  <Truck strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink-strong">دمغة الموردين</h4>
                  <p className="text-[10px] text-ink-muted">اسم المورد، هاتف، رصيد مستحق</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                قالب تسجيل شركات التوريد والموردين وأرقام التواصل وأرصدة الديون المستحقة لهم.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSuppliersStamp}
                className="w-full text-xs font-bold gap-1.5 border-warning-border text-warning bg-warning-bg/50 hover:bg-warning-bg"
              >
                <Download strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                <span>تحميل نموذج الموردين (.xlsx)</span>
              </Button>
            </CardContent>
          </Card>

          {/* دمغة المخزون الافتتاحي */}
          <Card className="hover:border-danger-border transition-colors border-line bg-surface">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-danger-bg text-danger-text flex items-center justify-center font-bold">
                  <Boxes strokeWidth={ICON_TOKENS.strokeWidth} className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink-strong">المخزون الافتتاحي</h4>
                  <p className="text-[10px] text-ink-muted">باركود، صنف، كمية فعلية، تكلفة</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                قالب جرد رصيد أول المدة الفعلي لضبط أرصدة المحل عند بدء التشغيل مباشرة.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadOpeningStockStamp}
                className="w-full text-xs font-bold gap-1.5 border-danger-border text-danger-text bg-danger-bg/50 hover:bg-danger-bg"
              >
                <Download strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                <span>تحميل نموذج المخزون (.xlsx)</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* منطقة رفع ملف الإكسيل */}
      <Card className="border-dashed border-2 border-flame bg-flame/10">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-flame text-abyssal flex items-center justify-center mx-auto shadow-accent">
            <Upload strokeWidth={ICON_TOKENS.strokeWidth} className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink-strong">
              ارفع ملف الإكسيل بعد تعبئة النموذج (.xlsx أو .xls)
            </h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
              يقوم النظام بفحص كل صف سطرًا بسطر وتمييز الصفوف الخاطئة مع إمكانية استيراد الصفوف الصالحة فقط.
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
            <span className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-flame hover:bg-flame-hover text-abyssal font-bold text-sm cursor-pointer shadow-accent transition-transform active:scale-95">
              {isLoading ? 'جاري فحص وتدقيق البيانات...' : 'اختيار واستعراض الملف'}
            </span>
          </label>
        </CardContent>
      </Card>

      {/* عرض نتائج الفحص والمعاينة وتدقيق الصفوف */}
      {sheetPreviews.length > 0 && currentPreview && valResult && (
        <div className="space-y-4">
          {sheetPreviews.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {sheetPreviews.map((preview, idx) => (
                <button
                  key={preview.sheetName}
                  onClick={() => setSelectedSheetIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors flex items-center gap-2 ${
                    selectedSheetIndex === idx
                      ? 'bg-flame text-abyssal border-flame shadow-sm'
                      : 'bg-surface text-ink border-line hover:bg-surface-alt'
                  }`}
                >
                  <span>{preview.sheetName}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-abyssal/15">
                    {preview.rowCount} سطر
                  </span>
                </button>
              ))}
            </div>
          )}

          <Card className="border-line">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line bg-surface-alt py-3.5">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span>تقرير فحص وتدقيق شيت: {currentPreview.sheetName}</span>
                  <Badge variant="info">النوع: {currentPreview.detectedEntity}</Badge>
                </CardTitle>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-ink-muted">
                    الإجمالي: <b className="text-ink-strong">{valResult.totalRows}</b> صف
                  </span>
                  <span className="text-success font-bold inline-flex items-center gap-1">
                    <Check strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                    <span>صالح: {valResult.validCount} صف</span>
                  </span>
                  {valResult.invalidCount > 0 && (
                    <span className="text-danger-text font-bold inline-flex items-center gap-1">
                      <XCircle strokeWidth={ICON_TOKENS.strokeWidth} className="w-3.5 h-3.5" />
                      <span>به أخطاء: {valResult.invalidCount} صف</span>
                    </span>
                  )}
                </div>
              </div>

              {can('import.execute') && (
                <Button
                  variant="primary"
                  size="md"
                  disabled={valResult.validCount === 0}
                  onClick={handleImportValidRowsOnly}
                  className="font-bold gap-2"
                >
                  <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4" />
                  <span>
                    استيراد الصفوف الصالحة فقط ({valResult.validCount} صف)
                  </span>
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {valResult.invalidCount > 0 ? (
                <div className="p-3 bg-warning-bg border border-warning-border rounded-xl text-xs text-ink-strong flex items-start gap-2">
                  <AlertTriangle strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      تم اكتشاف {valResult.invalidCount} صف يحتوي على أخطاء!
                    </span>
                    <span className="text-warning">
                      تم تظليل الصفوف غير الصالحة مع بيان سبب الخطأ. بالضغط على &quot;استيراد الصفوف الصالحة فقط&quot; سيتم حفظ الصفوف السليمة ({valResult.validCount} صف) وتخطي الصفوف الخاطئة بأمان.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-success-bg border border-success-border rounded-xl text-xs text-success flex items-center gap-2">
                  <CheckCircle2 strokeWidth={ICON_TOKENS.strokeWidth} className="w-4 h-4 text-success shrink-0" />
                  <span className="font-bold">
                    جميع الصفوف ({valResult.validCount} صف) سليمة وتطابق الشروط وجاهزة للاستيراد الفوري!
                  </span>
                </div>
              )}

              <div className="border border-line rounded-2xl overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-surface-alt font-bold border-b border-line text-ink sticky top-0 z-10">
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
                    <tbody className="divide-y divide-divider">
                      {valResult.rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={`transition-colors ${
                            row.isValid
                              ? 'bg-surface hover:bg-success-bg/40'
                              : 'bg-danger-bg/75 hover:bg-danger-bg border-r-4 border-truffle'
                          }`}
                        >
                          <td className="p-3 font-mono font-bold text-ink">
                            سطر {row.rowIndex}
                          </td>
                          <td className="p-3">
                            {row.isValid ? (
                              <Badge variant="success" className="text-[11px] gap-1">
                                <Check strokeWidth={ICON_TOKENS.strokeWidth} className="w-3 h-3" />
                                <span>صالح للاستيراد</span>
                              </Badge>
                            ) : (
                              <Badge variant="danger" className="text-[11px] gap-1">
                                <XCircle strokeWidth={ICON_TOKENS.strokeWidth} className="w-3 h-3" />
                                <span>غير صالح</span>
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {row.errors.length > 0 ? (
                              <ul className="text-danger-text font-bold text-[11px] list-disc list-inside space-y-0.5">
                                {row.errors.map((err, errIdx) => (
                                  <li key={errIdx}>{err}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-success font-medium text-[11px]">
                                البيانات مستوفية للشروط
                              </span>
                            )}
                          </td>
                          {currentPreview.columns.slice(0, 5).map((col) => (
                            <td key={col} className="p-3 text-ink-strong font-medium">
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
