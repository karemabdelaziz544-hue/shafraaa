import * as XLSX from 'xlsx';

export interface ValidatedRow {
  rowIndex: number;
  originalRow: Record<string, any>;
  data: any | null;
  isValid: boolean;
  errors: string[];
}

export interface ValidatedImportResult {
  sheetName: string;
  entityType: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: ValidatedRow[];
  validData: any[];
}

export interface SheetPreview {
  sheetName: string;
  rowCount: number;
  columns: string[];
  sampleData: Record<string, any>[];
  detectedEntity: string;
  mappedColumns: Record<string, string>;
  validationResult?: ValidatedImportResult;
}

// قواميس التعرف التلقائي على أسماء الأعمدة في ملفات الإكسيل
const COLUMN_ALIASES: Record<string, string[]> = {
  // منتجات
  name: ['اسم الصنف', 'اسم المنتج', 'الاسم', 'الصنف', 'البيان', 'product_name', 'name'],
  barcode: ['الباركود', 'باركود الصنف', 'كود الصنف', 'كود', 'باركود', 'barcode', 'code'],
  category: ['القسم', 'التصنيف', 'المجموعة', 'الفئة', 'category'],
  costPrice: ['سعر التكلفة', 'التكلفة', 'سعر الشراء', 'شراء', 'تكلفة', 'cost', 'cost_price'],
  extraCost: ['مصاريف إضافية', 'مصاريف نقل', 'تكلفة إضافية', 'نولون', 'extra_cost'],
  salePrice: ['سعر البيع', 'البيع', 'سعر المستهلك', 'سعر القطاعي', 'قطاعي', 'sale_price', 'price'],
  openingStock: ['رصيد أول المدة', 'الكمية الافتتاحية الفعلية', 'رصيد أول', 'المخزون الافتتاحي', 'الكمية', 'opening_stock', 'quantity'],
  minStockAlert: ['حد الطلب', 'حد إعادة الطلب', 'الحد الأدنى', 'تنبيه النواقص', 'min_alert'],
  unit: ['الوحدة', 'وحدة القياس', 'unit'],

  // عملاء وموردين
  phone: ['رقم الهاتف', 'الهاتف', 'الموبايل', 'التليفون', 'phone', 'mobile'],
  creditLimit: ['حد الائتمان', 'الحد الائتماني', 'أقصى دين', 'credit_limit'],
  currentBalance: ['الرصيد الافتتاحي', 'الرصيد', 'الحساب الحالي', 'المديونية', 'الرصيد المستحق', 'balance'],
  notes: ['ملاحظات', 'البيان', 'تفاصيل', 'notes'],
};

// التعرف على نوع الكيان من اسم الشيت
export function detectEntityType(sheetName: string): string {
  const s = sheetName.trim().toLowerCase();
  if (s.includes('مخزون افتتاحي') || s.includes('رصيد اول') || s.includes('رصيد أول') || s.includes('بداية النشاط')) return 'opening_stock';
  if (s.includes('منتج') || s.includes('أصناف') || s.includes('اصناف') || s.includes('بضاعة')) return 'products';
  if (s.includes('عميل') || s.includes('عملاء') || s.includes('زبائن')) return 'customers';
  if (s.includes('مورد') || s.includes('موردين') || s.includes('شركات')) return 'suppliers';
  if (s.includes('مصروف') || s.includes('مصاريف') || s.includes('نثريات')) return 'expenses';
  return 'general';
}

// قراءة ملف الإكسيل واستخراج بيانات ومعاينة الشيتات مع فحص وصلاحية كل صف
export async function parseExcelWorkbook(file: File): Promise<SheetPreview[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  const previews: SheetPreview[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    
    if (jsonData.length === 0) continue;

    const columns = Object.keys(jsonData[0] || {});
    const detectedEntity = detectEntityType(sheetName);
    
    // محاولة الربط التلقائي للأعمدة
    const mappedColumns: Record<string, string> = {};
    for (const [targetKey, aliases] of Object.entries(COLUMN_ALIASES)) {
      const matched = columns.find(col => 
        aliases.some(alias => col.trim().toLowerCase() === alias.toLowerCase() || col.trim().includes(alias))
      );
      if (matched) {
        mappedColumns[targetKey] = matched;
      }
    }

    const validationResult = validateAndProcessRows(jsonData, detectedEntity, mappedColumns);

    previews.push({
      sheetName,
      rowCount: jsonData.length,
      columns,
      sampleData: jsonData.slice(0, 10),
      detectedEntity,
      mappedColumns,
      validationResult,
    });
  }

  return previews;
}

// دالة فحص وتدقيق كل صف واكتشاف الأخطاء بدقة
export function validateAndProcessRows(
  rows: Record<string, any>[],
  entityType: string,
  mappedColumns: Record<string, string>
): ValidatedImportResult {
  const validatedRows: ValidatedRow[] = [];
  const validData: any[] = [];

  rows.forEach((row, index) => {
    const errors: string[] = [];
    const rowIndex = index + 2; // رقم الصف في ملف الإكسيل بعد رأس الجدول

    // التحقق من أن الصف ليس فارغاً تماماً
    const hasAnyValue = Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (!hasAnyValue) {
      return; // تخطي السطور الفارغة تماماً بدون أخطاء
    }

    let processedItem: any = null;

    if (entityType === 'products') {
      const nameCol = mappedColumns.name || 'اسم الصنف';
      const name = row[nameCol]?.toString().trim();
      if (!name) {
        errors.push('اسم الصنف مطلوب');
      }

      const costCol = mappedColumns.costPrice || 'سعر التكلفة';
      const rawCost = row[costCol];
      const costPrice = parseFloat(rawCost);
      if (rawCost === undefined || rawCost === '' || isNaN(costPrice) || costPrice < 0) {
        errors.push('سعر التكلفة يجب أن يكون رقماً أكبر من أو يساوي صفر');
      }

      const saleCol = mappedColumns.salePrice || 'سعر البيع';
      const rawSale = row[saleCol];
      const salePrice = parseFloat(rawSale);
      if (rawSale === undefined || rawSale === '' || isNaN(salePrice) || salePrice <= 0) {
        errors.push('سعر البيع يجب أن يكون رقماً أكبر من صفر');
      }

      const extraCost = parseFloat(row[mappedColumns.extraCost || 'مصاريف إضافية']) || 0;
      const openingStock = parseFloat(row[mappedColumns.openingStock || 'رصيد أول المدة']) || 0;
      const minAlert = parseFloat(row[mappedColumns.minStockAlert || 'حد الطلب']) || 5;

      if (errors.length === 0) {
        processedItem = {
          id: `imp-p-${Date.now()}-${index}`,
          name,
          barcode: row[mappedColumns.barcode || 'الباركود']?.toString().trim() || '',
          category: row[mappedColumns.category || 'القسم']?.toString().trim() || 'عام',
          costPrice: Number(costPrice.toFixed(2)),
          extraCost: Number(extraCost.toFixed(2)),
          salePrice: Number(salePrice.toFixed(2)),
          openingStock: Number(openingStock.toFixed(2)),
          currentStock: Number(openingStock.toFixed(2)),
          minStockAlert: Number(minAlert.toFixed(2)),
          unit: row[mappedColumns.unit || 'الوحدة']?.toString().trim() || 'قطعة',
          createdAt: new Date().toISOString(),
        };
      }
    } else if (entityType === 'customers') {
      const nameCol = mappedColumns.name || 'اسم العميل';
      const name = row[nameCol]?.toString().trim();
      if (!name) {
        errors.push('اسم العميل مطلوب');
      }

      const phone = row[mappedColumns.phone || 'رقم الهاتف']?.toString().trim() || '';
      const creditLimit = parseFloat(row[mappedColumns.creditLimit || 'حد الائتمان']) || 0;
      const initialBalance = parseFloat(row[mappedColumns.currentBalance || 'الرصيد الافتتاحي']) || 0;

      if (errors.length === 0) {
        processedItem = {
          id: `imp-c-${Date.now()}-${index}`,
          name,
          phone,
          creditLimit: Number(creditLimit.toFixed(2)),
          currentBalance: Number(initialBalance.toFixed(2)),
          notes: row[mappedColumns.notes || 'ملاحظات']?.toString().trim() || '',
          createdAt: new Date().toISOString(),
        };
      }
    } else if (entityType === 'suppliers') {
      const nameCol = mappedColumns.name || 'اسم المورد';
      const name = row[nameCol]?.toString().trim();
      if (!name) {
        errors.push('اسم المورد مطلوب');
      }

      const phone = row[mappedColumns.phone || 'رقم الهاتف']?.toString().trim() || '';
      const owedBalance = parseFloat(row[mappedColumns.currentBalance || 'الرصيد المستحق']) || 0;

      if (errors.length === 0) {
        processedItem = {
          id: `imp-s-${Date.now()}-${index}`,
          name,
          phone,
          company: '',
          owedBalance: Number(owedBalance.toFixed(2)),
          notes: row[mappedColumns.notes || 'ملاحظات']?.toString().trim() || '',
          createdAt: new Date().toISOString(),
        };
      }
    } else if (entityType === 'opening_stock') {
      const nameCol = mappedColumns.name || 'اسم الصنف';
      const name = row[nameCol]?.toString().trim();
      if (!name) {
        errors.push('اسم الصنف مطلوب');
      }

      const qtyCol = mappedColumns.openingStock || 'الكمية الافتتاحية الفعلية';
      const rawQty = row[qtyCol];
      const quantity = parseFloat(rawQty);
      if (rawQty === undefined || rawQty === '' || isNaN(quantity) || quantity < 0) {
        errors.push('الكمية الافتتاحية يجب أن تكون رقماً أكبر من أو يساوي صفر');
      }

      const costPrice = parseFloat(row[mappedColumns.costPrice || 'سعر التكلفة']) || 0;

      if (errors.length === 0) {
        processedItem = {
          name,
          barcode: row[mappedColumns.barcode || 'باركود الصنف']?.toString().trim() || '',
          openingStock: Number(quantity.toFixed(2)),
          costPrice: Number(costPrice.toFixed(2)),
          notes: row[mappedColumns.notes || 'ملاحظات']?.toString().trim() || '',
        };
      }
    } else {
      // الكيانات العامة
      processedItem = row;
    }

    const isValid = errors.length === 0 && processedItem !== null;
    if (isValid) {
      validData.push(processedItem);
    }

    validatedRows.push({
      rowIndex,
      originalRow: row,
      data: processedItem,
      isValid,
      errors,
    });
  });

  return {
    sheetName: entityType,
    entityType,
    totalRows: validatedRows.length,
    validCount: validData.length,
    invalidCount: validatedRows.length - validData.length,
    rows: validatedRows,
    validData,
  };
}

// ============================================================================
// نماذج الإكسيل الجاهزة ("الدمغات" - Stamp Templates) مع بيانات توضيحية وأعمدة ثابتة
// ============================================================================

function createWorkbookBlob(sheetData: any[], sheetName: string): Blob {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// 1. فورمة المنتجات
export function generateProductsTemplate(): Blob {
  const data = [
    {
      'اسم الصنف': 'شاحن سامسونج أصلي 25W سريع',
      'الباركود': '6221001001',
      'القسم': 'إلكترونيات',
      'سعر التكلفة': 180,
      'مصاريف إضافية': 5,
      'سعر البيع': 260,
      'رصيد أول المدة': 25,
      'حد الطلب': 5,
      'الوحدة': 'قطعة',
    },
    {
      'اسم الصنف': 'كابل تايب سي قماش مصفح 1.2M',
      'الباركود': '6221001002',
      'القسم': 'كابلات',
      'سعر التكلفة': 25,
      'مصاريف إضافية': 2,
      'سعر البيع': 50,
      'رصيد أول المدة': 40,
      'حد الطلب': 10,
      'الوحدة': 'قطعة',
    },
    {
      'اسم الصنف': 'سماعة بلوتوث لاسلكية Pro',
      'الباركود': '6221001003',
      'القسم': 'إلكترونيات',
      'سعر التكلفة': 120,
      'مصاريف إضافية': 0,
      'سعر البيع': 195,
      'رصيد أول المدة': 15,
      'حد الطلب': 4,
      'الوحدة': 'قطعة',
    },
  ];
  return createWorkbookBlob(data, 'المنتجات');
}

// 2. فورمة العملاء
export function generateCustomersTemplate(): Blob {
  const data = [
    {
      'اسم العميل': 'أحمد محمود إبراهيم',
      'رقم الهاتف': '01012345678',
      'حد الائتمان': 1000,
      'الرصيد الافتتاحي': 250,
      'ملاحظات': 'عميل ورشة سيارات منتظم',
    },
    {
      'اسم العميل': 'محمد علي السيد',
      'رقم الهاتف': '01198765432',
      'حد الائتمان': 500,
      'الرصيد الافتتاحي': 0,
      'ملاحظات': '',
    },
    {
      'اسم العميل': 'خالد عبد الرحمن',
      'رقم الهاتف': '01234567890',
      'حد الائتمان': 2000,
      'الرصيد الافتتاحي': 700,
      'ملاحظات': 'سداد شهري',
    },
  ];
  return createWorkbookBlob(data, 'العملاء');
}

// 3. فورمة الموردين
export function generateSuppliersTemplate(): Blob {
  const data = [
    {
      'اسم المورد': 'الشركة الهندسية للتوريدات',
      'رقم الهاتف': '01234567890',
      'الرصيد المستحق': 3400,
      'ملاحظات': 'توريد كابلات وشواحن',
    },
    {
      'اسم المورد': 'مؤسسة الأهرام لقطع الغيار',
      'رقم الهاتف': '01099887766',
      'الرصيد المستحق': 1500,
      'ملاحظات': 'مورد إلكترونيات ومفاتيح',
    },
  ];
  return createWorkbookBlob(data, 'الموردين');
}

// 4. فورمة المخزون الافتتاحي
export function generateOpeningStockTemplate(): Blob {
  const data = [
    {
      'باركود الصنف': '6221001001',
      'اسم الصنف': 'شاحن سامسونج أصلي 25W سريع',
      'الكمية الافتتاحية الفعلية': 25,
      'سعر التكلفة': 185,
      'ملاحظات': 'رصيد بداية النشاط الفعلي',
    },
    {
      'باركود الصنف': '6221001002',
      'اسم الصنف': 'كابل تايب سي قماش مصفح 1.2M',
      'الكمية الافتتاحية الفعلية': 40,
      'سعر التكلفة': 27,
      'ملاحظات': 'جرد أول المدة',
    },
    {
      'باركود الصنف': '6221001003',
      'اسم الصنف': 'سماعة بلوتوث لاسلكية Pro',
      'الكمية الافتتاحية الفعلية': 15,
      'سعر التكلفة': 120,
      'ملاحظات': '',
    },
  ];
  return createWorkbookBlob(data, 'المخزون الافتتاحي');
}

// 5. نموذج دفتر المحل الكامل (بدون خدمات)
export function generateShopTemplateWorkbook(): Blob {
  const wb = XLSX.utils.book_new();

  // المنتجات
  const products = [
    { 'اسم الصنف': 'شاحن سامسونج أصلي 25W', 'الباركود': '6221001001', 'القسم': 'إلكترونيات', 'سعر التكلفة': 180, 'مصاريف إضافية': 5, 'سعر البيع': 260, 'رصيد أول المدة': 20, 'حد الطلب': 5, 'الوحدة': 'قطعة' },
    { 'اسم الصنف': 'كابل شحن تايب سي قماش', 'الباركود': '6221001003', 'القسم': 'كابلات', 'سعر التكلفة': 25, 'مصاريف إضافية': 2, 'سعر البيع': 50, 'رصيد أول المدة': 50, 'حد الطلب': 10, 'الوحدة': 'قطعة' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), 'المنتجات');

  // العملاء
  const customers = [
    { 'اسم العميل': 'أحمد محمود', 'رقم الهاتف': '01012345678', 'حد الائتمان': 1000, 'الرصيد الافتتاحي': 250, 'ملاحظات': 'عميل منتظم' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers), 'العملاء');

  // الموردين
  const suppliers = [
    { 'اسم المورد': 'الشركة الهندسية للتوريدات', 'رقم الهاتف': '01234567890', 'الرصيد المستحق': 3400, 'ملاحظات': 'توريد كابلات وشواحن' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers), 'الموردين');

  // المخزون الافتتاحي
  const openingStock = [
    { 'باركود الصنف': '6221001001', 'اسم الصنف': 'شاحن سامسونج أصلي 25W', 'الكمية الافتتاحية الفعلية': 20, 'سعر التكلفة': 185, 'ملاحظات': 'رصيد بداية النشاط' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(openingStock), 'المخزون الافتتاحي');

  // المصروفات
  const expenses = [
    { 'النوع': 'ثابت', 'بند المصروف': 'إيجار المحل', 'المبلغ': 3000, 'التاريخ': '2026-11-01', 'ملاحظات': 'إيجار شهر نوفمبر' },
    { 'النوع': 'متغير', 'بند المصروف': 'أكياس وتغليف', 'المبلغ': 120, 'التاريخ': '2026-11-10', 'ملاحظات': '' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), 'المصروفات');

  // مسحوبات المالك
  const withdrawals = [
    { 'المالك': 'كريم', 'المبلغ': 500, 'التاريخ': '2026-11-20', 'السبب': 'مصاريف شخصية' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(withdrawals), 'مسحوبات المالك');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
