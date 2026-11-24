/**
 * المحرك الحسابي والمالي لمحل شفرة
 * المالك: كريم
 * القواعد الصارمة:
 * 1. النقود أرقام عشرية بدقة خانتين (numeric 12,2)
 * 2. الكاش ليس ربحاً: تكلفة وسعر بيع كل بند مخزنة بشكل دائم في بنود الفاتورة
 * 3. المصروفات الثابتة تخصم مرة واحدة فقط عند حساب صافي أرباح الفترة
 * 4. مسحوبات المالك ليست مصروفاً نهائياً
 * 5. صيغة المخزون = رصيد أول + مشتريات - مبيعات + مرتجع سليم - توالف + تسويات معتمدة
 */

export interface ProductItem {
  id: string;
  name: string;
  barcode?: string;
  costPrice: number;
  extraCost: number;
  salePrice: number;
  openingStock: number;
  currentStock: number;
  minStockAlert: number;
  category?: string;
}

export interface SaleInvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  lineCost: number;
  lineProfit: number;
}

export interface ExpenseItem {
  id: string;
  type: 'fixed' | 'variable';
  category: string;
  amount: number;
  paymentMethod: 'cash' | 'wallet' | 'instapay' | 'bank';
  date: string;
  notes?: string;
}

/**
 * 1. حساب هامش الربح كنسبة مئوية من سعر البيع
 * الهامش = ((سعر البيع - (التكلفة + المصاريف الإضافية)) / سعر البيع) * 100
 */
export function calculateProfitMargin(costPrice: number, extraCost: number, salePrice: number): number {
  if (salePrice <= 0) return 0;
  const totalCost = Number((costPrice + extraCost).toFixed(2));
  const profit = Number((salePrice - totalCost).toFixed(2));
  return Number(((profit / salePrice) * 100).toFixed(2));
}

/**
 * 2. حساب إجمالي وتكلفة وربح بند الفاتورة
 */
export function calculateInvoiceLine(
  quantity: number,
  unitCost: number,
  unitPrice: number,
  discount: number = 0
): { lineTotal: number; lineCost: number; lineProfit: number } {
  const lineTotal = Number(Math.max(0, quantity * unitPrice - discount).toFixed(2));
  const lineCost = Number((quantity * unitCost).toFixed(2));
  const lineProfit = Number((lineTotal - lineCost).toFixed(2));
  return { lineTotal, lineCost, lineProfit };
}

/**
 * 3. حساب إجماليات الفاتورة بالكامل
 */
export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unitCost: number; unitPrice: number; discount?: number }>,
  overallDiscount: number = 0,
  paidAmount: number = 0
) {
  let subtotal = 0;
  let totalCost = 0;

  for (const item of items) {
    const line = calculateInvoiceLine(item.quantity, item.unitCost, item.unitPrice, item.discount || 0);
    subtotal += line.lineTotal;
    totalCost += line.lineCost;
  }

  subtotal = Number(subtotal.toFixed(2));
  totalCost = Number(totalCost.toFixed(2));
  const discount = Number(overallDiscount.toFixed(2));
  const totalAmount = Number(Math.max(0, subtotal - discount).toFixed(2));
  const grossProfit = Number((totalAmount - totalCost).toFixed(2));
  const paid = Number(paidAmount.toFixed(2));
  const remainingDebt = Number(Math.max(0, totalAmount - paid).toFixed(2));

  return {
    subtotal,
    discount,
    totalAmount,
    totalCost,
    grossProfit,
    paidAmount: paid,
    remainingDebt,
  };
}

/**
 * 4. معادلة المخزون الصارمة:
 * المخزون = رصيد أول + مشتريات - مبيعات + مرتجع سليم - توالف + تسويات معتمدة
 */
export function calculateStockLevel(params: {
  openingStock: number;
  purchases: number;
  sales: number;
  sellableReturns: number;
  damaged: number;
  approvedAdjustments: number;
}): number {
  const stock =
    params.openingStock +
    params.purchases -
    params.sales +
    params.sellableReturns -
    params.damaged +
    params.approvedAdjustments;
  return Number(stock.toFixed(2));
}

/**
 * 5. حساب فارغ وتكلفة عجز/زيادة الجرد الفعلي
 * الفارق = الجرد الفعلي - رصيد النظام
 */
export function calculateInventoryVariance(countedStock: number, systemStock: number, unitCost: number) {
  const variance = Number((countedStock - systemStock).toFixed(2));
  const varianceCost = Number((variance * unitCost).toFixed(2));
  return {
    variance,
    varianceCost,
    isShortage: variance < 0,
    isSurplus: variance > 0,
    isExact: variance === 0,
  };
}

/**
 * 6. حساب صافي أرباح الفترة:
 * مجمل الربح - المصروفات المتغيرة - المصروفات الثابتة (تخصم مرة واحدة فقط في الفترة) - خسائر الهالك والتوالف
 * تنبيه حاسم: مسحوبات المالك ليست مصروفاً ولا تخصم من صافي الربح!
 */
export function calculatePeriodNetProfit(params: {
  totalGrossProfit: number;
  variableExpenses: number;
  fixedExpenses: number;
  damagedLoss?: number;
}): {
  grossProfit: number;
  totalExpenses: number;
  variableExpenses: number;
  fixedExpenses: number;
  damagedLoss: number;
  netProfit: number;
} {
  const grossProfit = Number(params.totalGrossProfit.toFixed(2));
  const variableExpenses = Number(params.variableExpenses.toFixed(2));
  const fixedExpenses = Number(params.fixedExpenses.toFixed(2));
  const damagedLoss = Number((params.damagedLoss || 0).toFixed(2));

  const totalExpenses = Number((variableExpenses + fixedExpenses).toFixed(2));
  const netProfit = Number((grossProfit - totalExpenses - damagedLoss).toFixed(2));

  return {
    grossProfit,
    totalExpenses,
    variableExpenses,
    fixedExpenses,
    damagedLoss,
    netProfit,
  };
}

/**
 * 7. معادلة تقفيل الدرج اليومي (اليومية):
 * الرصيد المتوقع بالدرج = رصيد أول + الوارد النقدي - المنصرف النقدي
 * الوارد النقدي = مبيعات كاش + سداد ديون عملاء كاش
 * المنصرف النقدي = مصروفات كاش + سداد موردين كاش + مرتجعات كاش + مسحوبات شخصية للمالك كاش
 * الفارق = الفعلي - المتوقع
 * تنبيه: المحافظ الإلكترونية وإنستاباي تتبع بشكل منفصل تماماً عن نقدية الدرج
 */
export function calculateDrawerExpectedCash(params: {
  openingCash: number;
  cashSales: number;
  cashDebtPayments: number;
  cashExpenses: number;
  cashSupplierPayments: number;
  cashReturns: number;
  cashWithdrawals: number;
  actualCash?: number;
}): {
  openingCash: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
  actualCash: number | null;
  difference: number | null;
  status: 'balanced' | 'surplus' | 'shortage' | 'open';
} {
  const openingCash = Number(params.openingCash.toFixed(2));
  const totalCashIn = Number((params.cashSales + params.cashDebtPayments).toFixed(2));
  const totalCashOut = Number(
    (params.cashExpenses + params.cashSupplierPayments + params.cashReturns + params.cashWithdrawals).toFixed(2)
  );

  const expectedCash = Number((openingCash + totalCashIn - totalCashOut).toFixed(2));

  if (params.actualCash === undefined || params.actualCash === null) {
    return {
      openingCash,
      totalCashIn,
      totalCashOut,
      expectedCash,
      actualCash: null,
      difference: null,
      status: 'open',
    };
  }

  const actualCash = Number(params.actualCash.toFixed(2));
  const difference = Number((actualCash - expectedCash).toFixed(2));

  let status: 'balanced' | 'surplus' | 'shortage' = 'balanced';
  if (difference > 0) status = 'surplus';
  else if (difference < 0) status = 'shortage';

  return {
    openingCash,
    totalCashIn,
    totalCashOut,
    expectedCash,
    actualCash,
    difference,
    status,
  };
}

/**
 * 8. فحص حد الائتمان للعميل عند البيع الآجل
 */
export function checkCustomerCreditLimit(
  currentBalance: number,
  newDebtAmount: number,
  creditLimit: number
): {
  isExceeded: boolean;
  totalAfterSale: number;
  excessAmount: number;
} {
  const totalAfterSale = Number((currentBalance + newDebtAmount).toFixed(2));
  const isExceeded = creditLimit > 0 && totalAfterSale > creditLimit;
  const excessAmount = isExceeded ? Number((totalAfterSale - creditLimit).toFixed(2)) : 0;

  return {
    isExceeded,
    totalAfterSale,
    excessAmount,
  };
}
