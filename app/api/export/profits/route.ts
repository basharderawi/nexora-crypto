import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import ExcelJS from 'exceljs';
import type { Database } from '@/lib/supabaseClient';
import { calculateProfitSummary } from '@/lib/profitSummary';

function parseDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Inclusive [from, to] via exclusive upper bound: fromStart <= x < toExclusive (toExclusive = start of to+1 day). */
function toDateRange(from: string, to: string): { fromStart: Date; toExclusive: Date } {
  const fromStart = new Date(`${from}T00:00:00.000Z`);
  const toExclusive = new Date(`${to}T00:00:00.000Z`);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  return { fromStart, toExclusive };
}

const shortId = (id: string) => (id.length >= 6 ? id.slice(-6) : id);

type OrderRow = {
  id: string;
  created_at: string;
  completed_at: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  amount_usdt: number | null;
  payment_method: string | null;
  status: string | null;
  notes: string | null;
  sell_price_ils_per_usdt: number | null;
  buy_avg_cost_ils_per_usdt: number | null;
  usd_ils_rate: number | null;
  profit_ils: number | null;
  profit_usd: number | null;
};

function num(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Use stored profit_ils/profit_usd; if missing, compute from sell/cost/amount and usd_ils_rate. */
function getProfit(
  row: Record<string, unknown>
): { profit_ils: number; profit_usd: number } {
  let profitIls = num(row, 'profit_ils');
  let profitUsd = num(row, 'profit_usd');
  const amount = num(row, 'amount_usdt');
  const sellPrice = num(row, 'sell_price_ils_per_usdt');
  const avgCost = num(row, 'buy_avg_cost_ils_per_usdt');
  const usdIls = num(row, 'usd_ils_rate');
  if (profitIls == null && amount != null && sellPrice != null && avgCost != null) {
    profitIls = amount * (sellPrice - avgCost);
  }
  if (profitUsd == null && profitIls != null && usdIls != null && usdIls > 0) {
    profitUsd = profitIls / usdIls;
  }
  return {
    profit_ils: profitIls ?? 0,
    profit_usd: profitUsd ?? 0,
  };
}

const isDev = process.env.NODE_ENV === 'development';
const NO_DATA_ROW = 'אין נתונים לטווח שנבחר';

const XLSX_CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(request: NextRequest) {
  const debugInfo: { from?: string; to?: string; fromIso?: string; toIso?: string; count?: number } = {};
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Ignored when response already sent
          }
        },
      },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    console.log('[export/profits]', { user: user?.id ?? null, userErr: userErr?.message ?? null });
    if (userErr || !user) {
      return NextResponse.json(
        { error: 'Not authenticated. Export requires a logged-in session (cookies).', reason: 'no_user' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const statusFilter = (searchParams.get('status') ?? 'completed') as string;

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const from = parseDate(fromParam) ?? firstDay.toISOString().slice(0, 10);
    const to = parseDate(toParam) ?? today.toISOString().slice(0, 10);

    const { fromStart, toExclusive } = toDateRange(from, to);
    const fromStartIso = fromStart.toISOString();
    const toExclusiveIso = toExclusive.toISOString();
    debugInfo.from = from;
    debugInfo.to = to;
    debugInfo.fromIso = fromStartIso;
    debugInfo.toIso = toExclusiveIso;

    // Inclusive [from, to]: gte(fromStart) AND lt(toExclusive)
    let orders: OrderRow[] = [];
    if (statusFilter === 'completed') {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, completed_at, full_name, phone, city, amount_usdt, payment_method, status, notes, sell_price_ils_per_usdt, buy_avg_cost_ils_per_usdt, usd_ils_rate, profit_ils, profit_usd')
        .eq('status', 'completed')
        .gte('completed_at', fromStartIso)
        .lt('completed_at', toExclusiveIso)
        .order('completed_at', { ascending: true });
      if (error) throw error;
      orders = (data ?? []) as OrderRow[];
    } else {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, completed_at, full_name, phone, city, amount_usdt, payment_method, status, notes, sell_price_ils_per_usdt, buy_avg_cost_ils_per_usdt, usd_ils_rate, profit_ils, profit_usd')
        .gte('created_at', fromStartIso)
        .lt('created_at', toExclusiveIso)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (statusFilter && statusFilter !== 'all') {
        orders = ((data ?? []) as OrderRow[]).filter((o) => o.status === statusFilter);
      } else {
        orders = (data ?? []) as OrderRow[];
      }
    }

    console.log('[export/profits] fromStart=%s toExclusive=%s rows.length=%d', fromStartIso, toExclusiveIso, orders.length);

    if (orders.length === 0) {
      return Response.json(
        {
          reason: 'no_data',
          error: 'No orders in the selected date range and status.',
          from,
          to,
          status: statusFilter,
        },
        { status: 200 }
      );
    }

    const completedOrders = orders.filter((o) => o.status === 'completed');
    const completedForSummary = completedOrders.map((o) => {
      const row = o as unknown as Record<string, unknown>;
      const { profit_ils: pIls, profit_usd: pUsd } = getProfit(row);
      return {
        amount_usdt: num(row, 'amount_usdt') ?? 0,
        profit_ils: pIls,
        profit_usd: pUsd,
        sell_price_ils_per_usdt: num(row, 'sell_price_ils_per_usdt'),
      };
    });
    const summary = calculateProfitSummary(completedForSummary);

    debugInfo.count = orders.length;

    if (orders.length > 0 && summary.totalSoldUsdt === 0 && summary.totalProfitIls === 0 && summary.totalProfitUsd === 0) {
      console.log('[export/profits] First order (raw):', JSON.stringify(orders[0], null, 2));
    }

    const { data: stateRow } = await supabase.from('inventory_state').select('usdt_balance, avg_cost_ils_per_usdt').eq('id', 1).single();
    const inventoryUsdt = (stateRow as { usdt_balance?: number } | null)?.usdt_balance ?? null;
    const avgCost = (stateRow as { avg_cost_ils_per_usdt?: number } | null)?.avg_cost_ils_per_usdt ?? null;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nexora';

    const numFmt2 = '0.00';
    const numFmt4 = '0.0000';
    const headerFont = { bold: true };
    const rtlAlignment = { horizontal: 'right' as const };

    const formatDate = (iso: string | null): string => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    // Sheet 1: סיכום – RTL, Row 1 = headers, Row 2 = values
    const sheet1 = workbook.addWorksheet('סיכום', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    const summaryHeaders = [
      'טווח תאריכים',
      'מספר הזמנות',
      'סה"כ USDT שנמכר',
      'רווח כולל ₪',
      'רווח כולל $',
      'מחיר מכירה ממוצע (₪/USDT)',
      'עלות ממוצעת (₪/USDT)',
    ];
    sheet1.addRow(summaryHeaders);
    sheet1.addRow([
      `${from} - ${to}`,
      Number(summary.orderCount),
      Number(summary.totalSoldUsdt),
      Number(summary.totalProfitIls),
      Number(summary.totalProfitUsd),
      summary.avgSellPrice != null ? Number(summary.avgSellPrice) : '',
      avgCost != null ? Number(avgCost) : '',
    ]);
    sheet1.getRow(1).font = headerFont;
    sheet1.getRow(1).alignment = rtlAlignment;
    sheet1.getRow(2).alignment = rtlAlignment;
    for (let c = 1; c <= 7; c++) sheet1.getColumn(c).width = c === 1 ? 18 : 16;
    for (let c = 2; c <= 7; c++) sheet1.getCell(2, c).numFmt = numFmt2;
    sheet1.getCell(2, 6).numFmt = numFmt4;
    sheet1.getCell(2, 7).numFmt = numFmt4;

    // Sheet 2: הזמנות – RTL, one row per order
    const sheet2 = workbook.addWorksheet('הזמנות', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    const orderCols = [
      { header: 'תאריך', key: 'date', width: 18 },
      { header: 'Order ID', key: 'order_id', width: 14 },
      { header: 'שם', key: 'name', width: 18 },
      { header: 'עיר', key: 'city', width: 14 },
      { header: 'טלפון', key: 'phone', width: 14 },
      { header: 'אמצעי תשלום', key: 'payment_method', width: 14 },
      { header: 'USDT', key: 'amount_usdt', width: 12 },
      { header: 'מחיר מכירה (₪/USDT)', key: 'sell_price', width: 18 },
      { header: 'עלות ממוצעת בעת מכירה (₪/USDT)', key: 'cost', width: 22 },
      { header: 'רווח ₪', key: 'profit_ils', width: 12 },
      { header: 'רווח $', key: 'profit_usd', width: 12 },
      { header: 'סטטוס', key: 'status', width: 10 },
    ];
    sheet2.columns = orderCols;

    if (orders.length > 0) {
      orders.forEach((o) => {
        const row = o as unknown as Record<string, unknown>;
        const { profit_ils: pIls, profit_usd: pUsd } = getProfit(row);
        const dateVal = o.status === 'completed' && o.completed_at ? o.completed_at : o.created_at;
        sheet2.addRow({
          date: formatDate(dateVal),
          order_id: shortId(o.id),
          name: (o.full_name ?? '') as string,
          city: (o.city ?? '') as string,
          phone: (o.phone ?? '') as string,
          payment_method: (o.payment_method ?? '') as string,
          amount_usdt: num(row, 'amount_usdt') ?? '',
          sell_price: num(row, 'sell_price_ils_per_usdt') ?? '',
          cost: num(row, 'buy_avg_cost_ils_per_usdt') ?? '',
          profit_ils: pIls,
          profit_usd: pUsd,
          status: (o.status ?? '') as string,
        });
      });
      const totalUsdt = completedOrders.reduce((s, o) => s + (num(o as unknown as Record<string, unknown>, 'amount_usdt') ?? 0), 0);
      const totalProfitIls = completedOrders.reduce((s, o) => s + getProfit(o as unknown as Record<string, unknown>).profit_ils, 0);
      const totalProfitUsd = completedOrders.reduce((s, o) => s + getProfit(o as unknown as Record<string, unknown>).profit_usd, 0);
      sheet2.addRow(['סה"כ', '', '', '', '', '', Number(totalUsdt), '', '', Number(totalProfitIls), Number(totalProfitUsd), '']);
      sheet2.getRow(sheet2.rowCount).font = headerFont;
    } else {
      sheet2.addRow([
        NO_DATA_ROW,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    }

    sheet2.getRow(1).font = headerFont;
    sheet2.getRow(1).alignment = rtlAlignment;
    sheet2.eachRow((r, i) => { if (i > 1) r.alignment = rtlAlignment; });
    for (let r = 2; r <= sheet2.rowCount; r++) {
      sheet2.getCell(r, 7).numFmt = numFmt2;
      sheet2.getCell(r, 8).numFmt = numFmt4;
      sheet2.getCell(r, 9).numFmt = numFmt4;
      sheet2.getCell(r, 10).numFmt = numFmt2;
      sheet2.getCell(r, 11).numFmt = numFmt2;
    }
    sheet2.autoFilter = { from: 'A1', to: 'L' + String(Math.max(2, sheet2.rowCount)) };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `nexora_report_${from}_to_${to}.xlsx`;
    const buf = buffer as unknown;
    const bytes: Uint8Array = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer);

    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': XLSX_CT,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[export/profits] error:', err);
    const message = err instanceof Error ? err.message : 'Export failed';
    if (isDev) {
      return Response.json(
        { ok: false, error: message, debug: debugInfo },
        { status: 500 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
