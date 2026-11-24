import { z } from 'zod';

// منتج جديد أو تعديل منتج
export const ProductSchema = z.object({
  name: z.string().min(2, { message: 'اسم المنتج مطلوب (حرفان على الأقل)' }),
  barcode: z.string().optional().default(''),
  category: z.string().optional().default('عام'),
  costPrice: z.number().min(0, { message: 'سعر التكلفة لا يمكن أن يكون سالباً' }),
  extraCost: z.number().min(0, { message: 'المصاريف الإضافية لا يمكن أن تكون سالبة' }).default(0),
  salePrice: z.number().min(0, { message: 'سعر البيع لا يمكن أن يكون سالباً' }),
  openingStock: z.number().default(0),
  minStockAlert: z.number().min(0, { message: 'حد إعادة الطلب لا يمكن أن يكون سالباً' }).default(5),
  unit: z.string().default('قطعة'),
}).refine((data) => data.salePrice >= data.costPrice + data.extraCost, {
  message: 'تنبيه: سعر البيع أقل من إجمالي التكلفة (عملية بيع بخسارة)',
  path: ['salePrice'],
});

// عميل
export const CustomerSchema = z.object({
  name: z.string().min(2, { message: 'اسم العميل مطلوب' }),
  phone: z.string().optional().default(''),
  creditLimit: z.number().min(0, { message: 'حد الائتمان لا يمكن أن يكون سالباً' }).default(0),
  notes: z.string().optional().default(''),
});

// مورد
export const SupplierSchema = z.object({
  name: z.string().min(2, { message: 'اسم المورد مطلوب' }),
  company: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

// بند في فاتورة بيع
export const SaleItemSchema = z.object({
  productId: z.string().min(1, { message: 'يجب اختيار المنتج' }),
  productName: z.string().min(1),
  quantity: z.number().positive({ message: 'الكمية يجب أن تكون أكبر من صفر' }),
  unitCost: z.number().min(0),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
});

// فاتورة بيع كاملة
export const SaleInvoiceSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().default('عميل نقدي'),
  items: z.array(SaleItemSchema).min(1, { message: 'يجب إضافة منتج واحد على الأقل للفاتورة' }),
  overallDiscount: z.number().min(0).default(0),
  paymentMethod: z.enum(['cash', 'wallet', 'instapay', 'credit', 'split']),
  paidAmount: z.number().min(0, { message: 'المبلغ المدفوع لا يمكن أن يكون سالباً' }),
  notes: z.string().optional().default(''),
});

// مصروف
export const ExpenseSchema = z.object({
  type: z.enum(['fixed', 'variable'], { message: 'نوع المصروف غير صالح' }),
  category: z.string().min(2, { message: 'بند المصروف مطلوب' }),
  amount: z.number().positive({ message: 'قيمة المصروف يجب أن تكون أكبر من صفر' }),
  paymentMethod: z.enum(['cash', 'wallet', 'instapay', 'bank']),
  date: z.string().min(10, { message: 'تاريخ المصروف مطلوب' }),
  notes: z.string().optional().default(''),
});

// مسحوبات شخصية للمالك
export const OwnerWithdrawalSchema = z.object({
  amount: z.number().positive({ message: 'مبلغ المسحوبات يجب أن يكون أكبر من صفر' }),
  paymentMethod: z.enum(['cash', 'wallet', 'instapay']),
  date: z.string().min(10, { message: 'التاريخ مطلوب' }),
  reason: z.string().min(2, { message: 'سبب المسحوبات مطلوب' }),
});

// تقفيل الدرج
export const DrawerClosingSchema = z.object({
  actualCash: z.number().min(0, { message: 'النقدية الفعلية بالدرج لا يمكن أن تكون سالبة' }),
  notes: z.string().optional().default(''),
});

// جرد فعلي
export const PhysicalCountItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  systemStock: z.number(),
  countedStock: z.number().min(0, { message: 'العدد الفعلي لا يمكن أن يكون سالباً' }),
  unitCost: z.number().min(0),
});
