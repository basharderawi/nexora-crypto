/**
 * Shared profit summary calculation – used by Admin Dashboard and Export API.
 * Source: orders table columns amount_usdt, profit_ils, profit_usd (and optionally sell_price_ils_per_usdt).
 */

export type OrderForSummary = {
  amount_usdt?: number | null;
  profit_ils?: number | null;
  profit_usd?: number | null;
  sell_price_ils_per_usdt?: number | null;
};

export type ProfitSummary = {
  totalSoldUsdt: number;
  totalProfitIls: number;
  totalProfitUsd: number;
  orderCount: number;
  avgSellPrice: number | null;
};

/**
 * Same logic as Admin Dashboard: sum amount_usdt, profit_ils, profit_usd over completed orders.
 * Call with the same rows you would use for the dashboard (e.g. from orders table, status = completed).
 */
function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export function calculateProfitSummary(completedOrders: OrderForSummary[]): ProfitSummary {
  const totalSoldUsdt = completedOrders.reduce((s, r) => s + toNum(r.amount_usdt), 0);
  const totalProfitIls = completedOrders.reduce((s, r) => s + toNum(r.profit_ils), 0);
  const totalProfitUsd = completedOrders.reduce((s, r) => s + toNum(r.profit_usd), 0);
  const orderCount = completedOrders.length;
  const avgSellPrice =
    orderCount > 0 && totalSoldUsdt > 0
      ? completedOrders.reduce((s, r) => s + toNum(r.sell_price_ils_per_usdt) * toNum(r.amount_usdt), 0) / totalSoldUsdt
      : null;
  return {
    totalSoldUsdt,
    totalProfitIls,
    totalProfitUsd,
    orderCount,
    avgSellPrice,
  };
}
