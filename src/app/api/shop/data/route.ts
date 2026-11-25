import { NextResponse } from 'next/server';
import { requireServerAuth } from '@/lib/supabase/server';
import {
  redactCostAndProfitFromInvoice,
  redactCostAndProfitFromProduct,
  type PermissionKey,
} from '@/lib/rbac';

/**
 * نقطة API محمية لاسترجاع البيانات بصلاحيات الدور على الخادم مع حجب التكلفة والأرباح تلقائياً
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'summary';

  const requiredMap: Record<string, PermissionKey> = {
    summary: 'dashboard.view',
    products: 'products.view',
    sales: 'sales.view',
    customers: 'customers.view',
    suppliers: 'suppliers.view',
    reports: 'reports.view',
    audit: 'audit.view',
  };

  const required = requiredMap[scope];
  if (!required) {
    return NextResponse.json({ ok: false, error: 'نطاق طلب غير معروف' }, { status: 400 });
  }

  const auth = await requireServerAuth(required);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { supabase, shopId, userId, permissions } = auth.ctx;
  const canSeeCostProfit = Boolean(permissions['finance.view_cost_profit']);

  if (scope === 'products') {
    const cols = canSeeCostProfit
      ? 'id, name, barcode, category_name, cost_price, extra_cost, sale_price, opening_stock, current_stock, min_stock_alert, unit, created_at'
      : 'id, name, barcode, category_name, sale_price, current_stock, min_stock_alert, unit, created_at';

    const { data, error } = await supabase
      .from('products')
      .select(cols)
      .eq('shop_id', shopId)
      .is('deleted_at', null);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({
      ok: true,
      canSeeCostProfit,
      products: (data || []).map((p: Record<string, any>) =>
        redactCostAndProfitFromProduct(p, canSeeCostProfit)
      ),
    });
  }

  if (scope === 'sales') {
    let query = supabase
      .from('sales_invoices')
      .select(
        canSeeCostProfit
          ? '*, sales_invoice_items(*)'
          : 'id, invoice_number, customer_id, customer_name, subtotal, discount, total_amount, paid_amount, remaining_amount, payment_method, status, created_by, created_by_name, created_at, sales_invoice_items(id, product_id, product_name, barcode, quantity, returned_quantity, unit_price, discount, line_total)'
      )
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!permissions['sales.view_all']) {
      query = query.eq('created_by', userId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      canSeeCostProfit,
      invoices: (data || []).map((inv: Record<string, any>) =>
        redactCostAndProfitFromInvoice(inv, canSeeCostProfit)
      ),
    });
  }

  if (scope === 'audit') {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, auditLogs: data || [] });
  }

  return NextResponse.json({
    ok: true,
    role: auth.ctx.role,
    permissions,
    canSeeCostProfit,
  });
}
