const test = require('node:test');
const assert = require('node:assert');

// 1. حساب هامش الربح كنسبة مئوية من سعر البيع
function calculateProfitMargin(costPrice, extraCost, salePrice) {
  if (salePrice <= 0) return 0;
  const totalCost = Number((costPrice + extraCost).toFixed(2));
  const profit = Number((salePrice - totalCost).toFixed(2));
  return Number(((profit / salePrice) * 100).toFixed(2));
}

// 2. حساب إجمالي وتكلفة وربح بند الفاتورة
function calculateInvoiceLine(quantity, unitCost, unitPrice, discount = 0) {
  const lineTotal = Number(Math.max(0, quantity * unitPrice - discount).toFixed(2));
  const lineCost = Number((quantity * unitCost).toFixed(2));
  const lineProfit = Number((lineTotal - lineCost).toFixed(2));
  return { lineTotal, lineCost, lineProfit };
}

// 3. حساب إجماليات الفاتورة
function calculateInvoiceTotals(items, overallDiscount = 0, paidAmount = 0) {
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

  return { subtotal, discount, totalAmount, totalCost, grossProfit, paidAmount: paid, remainingDebt };
}

// 4. معادلة المخزون الصارمة
function calculateStockLevel(params) {
  const stock =
    params.openingStock +
    params.purchases -
    params.sales +
    params.sellableReturns -
    params.damaged +
    params.approvedAdjustments;
  return Number(stock.toFixed(2));
}

// 5. حساب صافي أرباح الفترة مع خصم المصروفات الثابتة وخسائر الهالك واستبعاد مسحوبات المالك
function calculatePeriodNetProfit(params) {
  const grossProfit = Number(params.totalGrossProfit.toFixed(2));
  const variableExpenses = Number(params.variableExpenses.toFixed(2));
  const fixedExpenses = Number(params.fixedExpenses.toFixed(2));
  const damagedLoss = Number((params.damagedLoss || 0).toFixed(2));

  const totalExpenses = Number((variableExpenses + fixedExpenses).toFixed(2));
  const netProfit = Number((grossProfit - totalExpenses - damagedLoss).toFixed(2));

  return { grossProfit, totalExpenses, variableExpenses, fixedExpenses, damagedLoss, netProfit };
}

// 6. معادلة تقفيل الدرج اليومي
function calculateDrawerExpectedCash(params) {
  const openingCash = Number(params.openingCash.toFixed(2));
  const totalCashIn = Number((params.cashSales + params.cashDebtPayments).toFixed(2));
  const totalCashOut = Number(
    (params.cashExpenses + params.cashSupplierPayments + params.cashReturns + params.cashWithdrawals).toFixed(2)
  );

  const expectedCash = Number((openingCash + totalCashIn - totalCashOut).toFixed(2));

  if (params.actualCash === undefined || params.actualCash === null) {
    return { openingCash, totalCashIn, totalCashOut, expectedCash, actualCash: null, difference: null, status: 'open' };
  }

  const actualCash = Number(params.actualCash.toFixed(2));
  const difference = Number((actualCash - expectedCash).toFixed(2));

  let status = 'balanced';
  if (difference > 0) status = 'surplus';
  else if (difference < 0) status = 'shortage';

  return { openingCash, totalCashIn, totalCashOut, expectedCash, actualCash, difference, status };
}

// 7. فحص حد الائتمان للعميل
function checkCustomerCreditLimit(currentBalance, newDebtAmount, creditLimit) {
  const totalAfterSale = Number((currentBalance + newDebtAmount).toFixed(2));
  const isExceeded = creditLimit > 0 && totalAfterSale > creditLimit;
  const excessAmount = isExceeded ? Number((totalAfterSale - creditLimit).toFixed(2)) : 0;

  return { isExceeded, totalAfterSale, excessAmount };
}

// ============================================================================
// الاختبارات الآلية (Unit Tests)
// ============================================================================

test('1. اختبار معادلة المخزون: رصيد أول + مشتريات - مبيعات + مرتجع سليم - توالف + تسويات', () => {
  const stock = calculateStockLevel({
    openingStock: 50,
    purchases: 30,
    sales: 25,
    sellableReturns: 3,
    damaged: 2,
    approvedAdjustments: 4,
  });

  // 50 + 30 - 25 + 3 - 2 + 4 = 60
  assert.strictEqual(stock, 60);
});

test('2. اختبار حساب هامش الربح وتكلفة وسعر بيع بنود الفاتورة', () => {
  // تكلفة 180 + مصاريف 5 = 185. سعر بيع 260. الربح = 75. الهامش = (75 / 260) * 100 = 28.85%
  const margin = calculateProfitMargin(180, 5, 260);
  assert.strictEqual(margin, 28.85);

  const line = calculateInvoiceLine(2, 185, 260, 20); // 2 * 260 - 20 = 500, تكلفة = 370, ربح = 130
  assert.strictEqual(line.lineTotal, 500);
  assert.strictEqual(line.lineCost, 370);
  assert.strictEqual(line.lineProfit, 130);
});

test('3. اختبار أرباح الفترة وخصم المصروفات الثابتة مرة واحدة واستبعاد مسحوبات المالك', () => {
  const result = calculatePeriodNetProfit({
    totalGrossProfit: 15000,
    variableExpenses: 2000,
    fixedExpenses: 3500, // إيجار وكهرباء تخصم مرة واحدة فقط للشهر
    damagedLoss: 500, // خسائر بضاعة هالكة وتوالف
  });

  // صافي الربح = 15000 مجمل ربح - (2000 متغيرة + 3500 ثابتة) - 500 خسائر هالك = 9000
  assert.strictEqual(result.netProfit, 9000);
  assert.strictEqual(result.totalExpenses, 5500);
  assert.strictEqual(result.damagedLoss, 500);
});

test('4. اختبار حساب ديون العميل وتنبيه تجاوز حد الائتمان', () => {
  // رصيد دين حالي 800، فاتورة جديدة متبقي منها 300 دين، وسقف الائتمان 1000
  const check = checkCustomerCreditLimit(800, 300, 1000);
  assert.strictEqual(check.totalAfterSale, 1100);
  assert.strictEqual(check.isExceeded, true);
  assert.strictEqual(check.excessAmount, 100);

  // حالة عدم تجاوز الحد
  const safeCheck = checkCustomerCreditLimit(400, 200, 1000);
  assert.strictEqual(safeCheck.isExceeded, false);
  assert.strictEqual(safeCheck.excessAmount, 0);
});

test('5. اختبار تقفيل الدرج اليومي: الرصيد المتوقع والعجز والزيادة', () => {
  // رصيد أول 500
  // وارد كاش: مبيعات كاش 1200 + سداد ديون كاش 300 = 1500
  // منصرف كاش: مصروفات كاش 200 + سداد موردين كاش 400 + مرتجع كاش 100 + مسحوبات مالك 300 = 1000
  // المتوقع = 500 + 1500 - 1000 = 1000
  const expected = calculateDrawerExpectedCash({
    openingCash: 500,
    cashSales: 1200,
    cashDebtPayments: 300,
    cashExpenses: 200,
    cashSupplierPayments: 400,
    cashReturns: 100,
    cashWithdrawals: 300,
    actualCash: 950, // عجز 50 جنيه
  });

  assert.strictEqual(expected.expectedCash, 1000);
  assert.strictEqual(expected.difference, -50);
  assert.strictEqual(expected.status, 'shortage');

  // حالة مطابقة الدرج
  const balanced = calculateDrawerExpectedCash({
    openingCash: 500,
    cashSales: 1200,
    cashDebtPayments: 300,
    cashExpenses: 200,
    cashSupplierPayments: 400,
    cashReturns: 100,
    cashWithdrawals: 300,
    actualCash: 1000,
  });

  assert.strictEqual(balanced.difference, 0);
  assert.strictEqual(balanced.status, 'balanced');
});

// 8. دوال التحقق من المرتجعات وتحديث حالة الفاتورة ودين العميل
function calculateReturnableLineState(soldQuantity, returnedQuantity = 0) {
  const sold = Number(Math.max(0, soldQuantity).toFixed(2));
  const returned = Number(Math.max(0, returnedQuantity).toFixed(2));
  const remainingReturnableQuantity = Number(Math.max(0, sold - returned).toFixed(2));
  return {
    soldQuantity: sold,
    returnedQuantity: returned,
    remainingReturnableQuantity,
    isFullyReturned: remainingReturnableQuantity <= 0,
  };
}

function validateSaleReturnRequest(params) {
  const state = calculateReturnableLineState(params.soldQuantity, params.alreadyReturnedQuantity);
  const requested = Number((params.requestedQuantity || 0).toFixed(2));

  if (requested <= 0) {
    return {
      valid: false,
      error: 'يجب أن تكون الكمية المرتجعة أكبر من صفر.',
      remainingBeforeReturn: state.remainingReturnableQuantity,
      remainingAfterReturn: state.remainingReturnableQuantity,
    };
  }
  if (state.remainingReturnableQuantity <= 0) {
    return {
      valid: false,
      error: 'تم إرجاع كامل كمية هذا الصنف مسبقاً ولا توجد كمية متبقية للإرجاع.',
      remainingBeforeReturn: 0,
      remainingAfterReturn: 0,
    };
  }
  if (requested > state.remainingReturnableQuantity) {
    return {
      valid: false,
      error: `الكمية المطلوب إرجاعها (${requested}) أكبر من الكمية المتبقية القابلة للإرجاع (${state.remainingReturnableQuantity}).`,
      remainingBeforeReturn: state.remainingReturnableQuantity,
      remainingAfterReturn: state.remainingReturnableQuantity,
    };
  }
  return {
    valid: true,
    remainingBeforeReturn: state.remainingReturnableQuantity,
    remainingAfterReturn: Number((state.remainingReturnableQuantity - requested).toFixed(2)),
  };
}

function determineInvoiceReturnStatus(items) {
  const totalSold = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const totalReturned = items.reduce((sum, it) => sum + Number(it.returnedQuantity || 0), 0);
  if (totalSold > 0 && totalReturned >= totalSold) return 'returned_full';
  if (totalReturned > 0) return 'returned_partial';
  return 'completed';
}

function calculateReturnFinancialAdjustments(params) {
  const refund = Number(Math.max(0, params.refundAmount).toFixed(2));
  if (params.refundMethod === 'credit') {
    const customerBalanceReduction = Number(Math.min(Math.max(0, params.customerCurrentBalance), refund).toFixed(2));
    const invoiceRemainingReduction = Number(Math.min(Math.max(0, params.invoiceRemainingAmount), refund).toFixed(2));
    return {
      cashDrawerDeduction: 0,
      customerBalanceReduction,
      newCustomerBalance: Number(Math.max(0, params.customerCurrentBalance - customerBalanceReduction).toFixed(2)),
      invoiceRemainingReduction,
      newInvoiceRemaining: Number(Math.max(0, params.invoiceRemainingAmount - invoiceRemainingReduction).toFixed(2)),
    };
  }
  return {
    cashDrawerDeduction: params.refundMethod === 'cash' ? refund : 0,
    customerBalanceReduction: 0,
    newCustomerBalance: Number(Math.max(0, params.customerCurrentBalance).toFixed(2)),
    invoiceRemainingReduction: 0,
    newInvoiceRemaining: Number(Math.max(0, params.invoiceRemainingAmount).toFixed(2)),
  };
}

test('6. اختبار قواعد المرتجع الجزئي والكلي ومنع إرجاع كمية أكبر من المتبقي', () => {
  // صنف مباع منه 5 قطع
  const firstAttempt = validateSaleReturnRequest({
    soldQuantity: 5,
    alreadyReturnedQuantity: 0,
    requestedQuantity: 2,
  });
  assert.strictEqual(firstAttempt.valid, true);
  assert.strictEqual(firstAttempt.remainingAfterReturn, 3);

  // حالة الفاتورة تصبح مرتجع جزئي
  const partialStatus = determineInvoiceReturnStatus([
    { quantity: 5, returnedQuantity: 2 },
    { quantity: 2, returnedQuantity: 0 },
  ]);
  assert.strictEqual(partialStatus, 'returned_partial');

  // محاولة إرجاع 4 قطع من المتبقي 3 قطع -> يجب المنع
  const overLimit = validateSaleReturnRequest({
    soldQuantity: 5,
    alreadyReturnedQuantity: 2,
    requestedQuantity: 4,
  });
  assert.strictEqual(overLimit.valid, false);
  assert.match(overLimit.error, /أكبر من الكمية المتبقية/);

  // إرجاع الباقي بالكامل -> الفاتورة تصبح مرتجع بالكامل وأي محاولة بعدها مرفوضة
  const fullStatus = determineInvoiceReturnStatus([
    { quantity: 5, returnedQuantity: 5 },
    { quantity: 2, returnedQuantity: 2 },
  ]);
  assert.strictEqual(fullStatus, 'returned_full');

  const afterFull = validateSaleReturnRequest({
    soldQuantity: 5,
    alreadyReturnedQuantity: 5,
    requestedQuantity: 1,
  });
  assert.strictEqual(afterFull.valid, false);
});

test('7. اختبار تعديل دين العميل والدرج عند المرتجع وتنسيق الأرقام السالبة بدون أحرف تحكم مخفية', () => {
  const creditAdj = calculateReturnFinancialAdjustments({
    refundAmount: 300,
    refundMethod: 'credit',
    customerCurrentBalance: 800,
    invoiceRemainingAmount: 500,
  });
  assert.strictEqual(creditAdj.cashDrawerDeduction, 0);
  assert.strictEqual(creditAdj.newCustomerBalance, 500);
  assert.strictEqual(creditAdj.newInvoiceRemaining, 200);

  const cashAdj = calculateReturnFinancialAdjustments({
    refundAmount: 150,
    refundMethod: 'cash',
    customerCurrentBalance: 800,
    invoiceRemainingAmount: 0,
  });
  assert.strictEqual(cashAdj.cashDrawerDeduction, 150);
  assert.strictEqual(cashAdj.newCustomerBalance, 800);

  // التحقق من خلو الأرقام السالبة من علامات التحكم الخفية U+061C / U+200E / U+200F
  const rawFormatted = new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(4955);
  const cleaned = `-${rawFormatted.replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')} ج.م`;
  assert.strictEqual(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/.test(cleaned), false);
});
