'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { calculateProfitSummary } from '@/lib/profitSummary';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type OrderRow = {
  id: string;
  created_at: string;
  full_name: string | null;
  city: string | null;
  amount_usdt: number | null;
  payment_method: string | null;
  status: string | null;
};

type InventoryState = {
  id: number;
  usdt_balance: number;
  total_cost_ils: number;
  avg_cost_ils_per_usdt: number;
  updated_at: string;
} | null;

type Aggregates = {
  totalSoldUsdt: number;
  totalProfitIls: number;
  totalProfitUsd: number;
};

type AppSettings = {
  id: number;
  sell_price_ils_per_usdt: number;
  updated_at: string;
} | null;

/** Row shape for app_settings table (for typed updates) */
type AppSettingsRow = {
  id: number;
  sell_price_ils_per_usdt: number | null;
  updated_at?: string | null;
};

const STATUS_OPTIONS = [
  { value: '', label: 'הכל' },
  { value: 'new', label: 'New' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'הכל' },
  { value: 'BIT', label: 'BIT' },
  { value: 'CASH_MEETUP', label: 'CASH_MEETUP' },
  { value: 'CASH_WITHOUT_CARD', label: 'CASH_WITHOUT_CARD' },
];

function shortId(id: string): string {
  return id.length >= 6 ? id.slice(-6) : id;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [inventory, setInventory] = useState<InventoryState>(null);
  const [aggregates, setAggregates] = useState<Aggregates>({
    totalSoldUsdt: 0,
    totalProfitIls: 0,
    totalProfitUsd: 0,
  });
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const [addBatchModalOpen, setAddBatchModalOpen] = useState(false);
  const [batchAmount, setBatchAmount] = useState('');
  const [batchPrice, setBatchPrice] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [addBatchSaving, setAddBatchSaving] = useState(false);

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const [completeModalOrder, setCompleteModalOrder] = useState<OrderRow | null>(null);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [appSettings, setAppSettings] = useState<AppSettings>(null);
  const [sellPriceEdit, setSellPriceEdit] = useState('');
  const [sellPriceSaving, setSellPriceSaving] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

  const [exportModalOpen, setExportModalOpen] = useState(false);
  // Store dates as YYYY-MM-DD only (native <input type="date"> value); sent as-is to API
  const toYYYYMMDD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date();
    return toYYYYMMDD(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [exportTo, setExportTo] = useState(() => toYYYYMMDD(new Date()));
  const [exportStatus, setExportStatus] = useState<'completed' | 'all'>('completed');
  const [exportDownloading, setExportDownloading] = useState(false);

  const [manualOrderModalOpen, setManualOrderModalOpen] = useState(false);
  const [manualOrderFullName, setManualOrderFullName] = useState('');
  const [manualOrderPhone, setManualOrderPhone] = useState('');
  const [manualOrderCity, setManualOrderCity] = useState('');
  const [manualOrderAmount, setManualOrderAmount] = useState('');
  const [manualOrderPaymentMethod, setManualOrderPaymentMethod] = useState<string>('BIT');
  const [manualOrderNotes, setManualOrderNotes] = useState('');
  const [manualOrderSaving, setManualOrderSaving] = useState(false);

  const fetchOrders = useCallback(async () => {
    let query = supabase
      .from('orders')
      .select('id, created_at, full_name, city, amount_usdt, payment_method, status')
      .order('created_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    if (paymentFilter) query = query.eq('payment_method', paymentFilter);
    const { data } = await query;
    setOrders((data as OrderRow[]) ?? []);
  }, [statusFilter, paymentFilter]);

  const fetchInventoryAndAggregates = useCallback(async () => {
    const { data: invData, error: invError } = await supabase
      .from('inventory_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (invError) throw invError;
    setInventory((invData ?? null) as InventoryState | null);

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('amount_usdt, profit_ils, profit_usd, sell_price_ils_per_usdt')
      .eq('status', 'completed');
    if (ordersError) throw ordersError;
    const completed = (ordersData ?? []) as {
      amount_usdt?: number;
      profit_ils?: number;
      profit_usd?: number;
      sell_price_ils_per_usdt?: number;
    }[];
    const summary = calculateProfitSummary(completed);
    setAggregates({
      totalSoldUsdt: summary.totalSoldUsdt,
      totalProfitIls: summary.totalProfitIls,
      totalProfitUsd: summary.totalProfitUsd,
    });
  }, []);

  const fetchAppSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (data) {
      setAppSettings(data as AppSettings);
      setSellPriceEdit(String((data as { sell_price_ils_per_usdt: number }).sell_price_ils_per_usdt));
    } else setAppSettings(null);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/admin/login');
        return;
      }
      setAuthChecked(true);
    })();
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      setLoading(true);
      await Promise.all([fetchOrders(), fetchInventoryAndAggregates(), fetchAppSettings()]);
      setLoading(false);
    })();
  }, [authChecked, statusFilter, paymentFilter, fetchOrders, fetchInventoryAndAggregates, fetchAppSettings]);

  async function handleSellPriceSave() {
    const val = parseFloat(sellPriceEdit);
    if (Number.isNaN(val) || val <= 0) {
      toast.error('הזן מחיר גדול מ-0');
      return;
    }
    setSellPriceSaving(true);
    try {
      const updatePayload: Partial<AppSettingsRow> = {
        sell_price_ils_per_usdt: val,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('app_settings').update(updatePayload as never).eq('id', 1);
      if (error) throw error;
      toast.success('מחיר המכירה עודכן');
      await fetchAppSettings();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'שגיאה בעדכון המחיר');
    } finally {
      setSellPriceSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  async function handleResetAllData() {
    if (!confirm('This will permanently delete ALL orders and inventory data. Are you sure?')) return;
    console.log("[RESET] clicked");
    setResetLoading(true);
    try {
      const { data, error } = await supabase.rpc("reset_all_data");
      console.log("[RESET] data:", data);
      console.log("[RESET] error:", error);
      if (error) {
        const err = error as { message?: string; details?: string };
        const msg = [err?.message, err?.details].filter(Boolean).join(' | ') || 'Reset failed';
        toast.error(msg);
        return;
      }
      if (data?.ok === false) {
        toast.error((data as { error?: string }).error ?? "Reset failed");
        return;
      }
      toast.success("All data reset");
      setAddBatchModalOpen(false);
      setAdjustModalOpen(false);
      setCompleteModalOrder(null);
      await fetchInventoryAndAggregates();
      await fetchOrders();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleAddBatch() {
    const amount = Number(batchAmount);
    const buyPrice = Number(batchPrice);
    const note = batchNote?.trim() ? batchNote.trim() : null;

    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('כמות חייבת להיות גדולה מ-0');
      return;
    }
    if (Number.isNaN(buyPrice) || buyPrice <= 0) {
      toast.error('מחיר הרכישה חייב להיות גדול מ-0');
      return;
    }

    setAddBatchSaving(true);
    try {
      const { data, error } = await supabase.rpc('add_inventory', {
        p_amount_usdt: amount,
        p_buy_price: buyPrice,
        p_note: note,
      });
      if (error) {
        const err = error as { message?: string; details?: string };
        const msg = [err?.message, err?.details].filter(Boolean).join(' | ') || 'שגיאה בהוספת מלאי';
        toast.error(msg);
        return;
      }
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.ok === false) {
        toast.error(result.error ?? 'שגיאה בהוספת מלאי');
        return;
      }
      toast.success('המלאי נוסף');
      setAddBatchModalOpen(false);
      setBatchAmount('');
      setBatchPrice('');
      setBatchNote('');
      await fetchInventoryAndAggregates();
      await fetchOrders();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'שגיאה בהוספת מלאי');
    } finally {
      setAddBatchSaving(false);
    }
  }

  async function handleAdjustInventory() {
    const amount = Number(adjustAmount);
    const note = adjustNote?.trim() || null;

    if (Number.isNaN(amount) || amount === 0) {
      toast.error('הזן כמות (חיובית או שלילית, לא אפס)');
      return;
    }
    if (amount < 0 && !note) {
      toast.error('הערה חובה בעת התאמה שלילית');
      return;
    }

    setAdjustSaving(true);
    try {
      const { data, error } = await supabase.rpc('adjust_inventory', {
        p_amount_usdt: amount,
        p_note: note,
      });
      if (error) {
        const err = error as { message?: string; details?: string };
        const msg = [err?.message, err?.details].filter(Boolean).join(' | ') || 'שגיאה בהתאמת מלאי';
        toast.error(msg);
        return;
      }
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.ok === false) {
        toast.error(result.error ?? 'שגיאה בהתאמת מלאי');
        return;
      }
      toast.success('המלאי עודכן');
      setAdjustModalOpen(false);
      setAdjustAmount('');
      setAdjustNote('');
      await fetchInventoryAndAggregates();
      await fetchOrders();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'שגיאה בהתאמת מלאי');
    } finally {
      setAdjustSaving(false);
    }
  }

  async function handleCreateManualOrder() {
    const full_name = manualOrderFullName?.trim() || '';
    const phone = manualOrderPhone?.trim() || '';
    const city = manualOrderCity?.trim() || '';
    const amountVal = Number(manualOrderAmount);
    const payment_method = manualOrderPaymentMethod || 'BIT';
    const notes = manualOrderNotes?.trim() || null;

    if (!full_name) {
      toast.error('Full name is required');
      return;
    }
    if (!phone) {
      toast.error('Phone is required');
      return;
    }
    if (!city) {
      toast.error('City is required');
      return;
    }
    if (Number.isNaN(amountVal) || amountVal <= 0) {
      toast.error('Amount (USDT) must be greater than 0');
      return;
    }

    const sell_price_ils_per_usdt =
      appSettings?.sell_price_ils_per_usdt != null ? appSettings.sell_price_ils_per_usdt : null;

    setManualOrderSaving(true);
    try {
      const { error } = await supabase.from('orders').insert({
        full_name,
        phone,
        city,
        amount_usdt: amountVal,
        payment_method,
        notes,
        status: 'new',
        sell_price_ils_per_usdt,
      });
      if (error) throw error;
      toast.success('Manual order created successfully');
      setManualOrderModalOpen(false);
      setManualOrderFullName('');
      setManualOrderPhone('');
      setManualOrderCity('');
      setManualOrderAmount('');
      setManualOrderPaymentMethod('BIT');
      setManualOrderNotes('');
      await fetchOrders();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create order');
    } finally {
      setManualOrderSaving(false);
    }
  }

  async function handleCancelOrder(order: OrderRow) {
    setCancellingId(order.id);
    try {
      const { data, error } = await supabase.rpc('cancel_order', {
        p_order_id: order.id,
        p_note: null,
      });
      if (error) {
        const err = error as { message?: string; details?: string };
        const msg = [err?.message, err?.details].filter(Boolean).join(' | ') || 'ביטול נכשל';
        toast.error(msg);
        return;
      }
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.ok === false) {
        toast.error(result.error ?? 'ביטול נכשל');
        return;
      }
      toast.success('ההזמנה בוטלה');
      await fetchOrders();
      await fetchInventoryAndAggregates();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'ביטול נכשל');
    } finally {
      setCancellingId(null);
    }
  }

  async function handleDeleteOrder(order: OrderRow) {
    if (!confirm('לבטל ולהסיר את ההזמנה מהרשימה? (סטטוס יישמר כ־cancelled)')) return;
    setDeletingId(order.id);
    try {
      const { data, error } = await supabase.rpc('cancel_order', {
        p_order_id: order.id,
        p_note: null,
      });
      if (error) {
        const err = error as { message?: string; details?: string };
        const msg = [err?.message, err?.details].filter(Boolean).join(' | ') || 'מחיקת ההזמנה נכשלה';
        toast.error(msg);
        return;
      }
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.ok === false) {
        toast.error(result.error ?? 'מחיקת ההזמנה נכשלה');
        return;
      }
      toast.success('ההזמנה בוטלה');
      await fetchOrders();
      await fetchInventoryAndAggregates();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'מחיקת ההזמנה נכשלה');
    } finally {
      setDeletingId(null);
    }
  }

  function openExportModal() {
    const d = new Date();
    setExportFrom(toYYYYMMDD(new Date(d.getFullYear(), d.getMonth(), 1)));
    setExportTo(toYYYYMMDD(d));
    setExportStatus('completed');
    setExportModalOpen(true);
  }

  async function handleExportDownload() {
    setExportDownloading(true);
    try {
      const from = String(exportFrom).trim();
      const to = String(exportTo).trim();
      const status = exportStatus;

      const url = `/api/export/profits?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&status=${encodeURIComponent(status)}`;
      const res = await fetch(url);
      const ct = res.headers.get("Content-Type") || "";

      const isXlsx = ct.includes("sheet") || ct.includes("spreadsheetml");
      if (isXlsx) {
        if (!res.ok) {
          toast.error(`Export failed: ${res.status}`);
          return;
        }
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `nexora_report_${from}_to_${to}.xlsx`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        toast.success("הורדה החלה");
        setExportModalOpen(false);
        return;
      }

      const text = await res.text();
      if (!res.ok) {
        console.error("[EXPORT]", res.status, ct, text);
        toast.error(`Export failed: ${res.status}. See console.`);
        return;
      }
      try {
        const json = JSON.parse(text) as { error?: string };
        toast.error(json?.error ?? text.slice(0, 100));
      } catch {
        toast.error("Export did not return an Excel file. See console.");
      }
      console.error("[EXPORT] Content-Type:", ct, "body:", text.slice(0, 200));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportDownloading(false);
    }
  }

  async function handleCompleteConfirm() {
    if (!completeModalOrder) return;
    const currentSellPrice = appSettings?.sell_price_ils_per_usdt;
    if (currentSellPrice == null || Number.isNaN(Number(currentSellPrice)) || Number(currentSellPrice) <= 0) {
      toast.error('Set Current Sell Price first');
      return;
    }
    const sellPrice = Number(currentSellPrice);
    const amount = completeModalOrder.amount_usdt ?? 0;
    if (inventory && (inventory.usdt_balance < amount)) {
      toast.error('יתרת מלאי לא מספקת');
      return;
    }
    setCompleteSubmitting(true);
    try {
      const rateRes = await fetch('/api/usd-ils');
      if (!rateRes.ok) throw new Error('Failed to fetch USD/ILS rate');
      const { rate } = await rateRes.json();
      const { data, error } = await supabase.rpc('complete_order', {
        p_order_id: completeModalOrder.id,
        p_sell_price: sellPrice,
        p_usd_ils_rate: rate ?? null,
      });
      if (error) {
        const err = error as { message?: string; details?: string };
        const msg = [err?.message, err?.details].filter(Boolean).join(' | ') || 'השלמת ההזמנה נכשלה';
        toast.error(msg);
        return;
      }
      const result = data as { ok?: boolean; error?: string };
      if (result?.ok === false) {
        toast.error(result.error ?? 'השלמת ההזמנה נכשלה');
        return;
      }
      toast.success('ההזמנה הושלמה');
      setCompleteModalOrder(null);
      await fetchOrders();
      await fetchInventoryAndAggregates();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'השלמת ההזמנה נכשלה');
    } finally {
      setCompleteSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[var(--muted)]">טוען…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text)]">
          <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary2)] bg-clip-text text-transparent">
            Admin Dashboard
          </span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {isDev && (
            <>
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-400">
                DEV ONLY
              </span>
              <Button
                variant="ghost"
                className="!py-1.5 !px-3 !text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                onClick={handleResetAllData}
                disabled={resetLoading}
              >
                {resetLoading ? 'Resetting…' : 'Reset All Data'}
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Control Bar: Sell Price (left) + Init Inventory (right) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Card className="flex-1 sm:min-w-0">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-1 text-xs text-[var(--muted)]">Current Sell Price (ILS per 1 USDT)</p>
              <p dir="ltr" className="text-lg font-semibold text-[var(--text)]">
                {appSettings?.sell_price_ils_per_usdt ?? '—'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="number"
                step="any"
                min={0}
                value={sellPriceEdit}
                onChange={(e) => setSellPriceEdit(e.target.value)}
                placeholder="0"
                dir="ltr"
                className="w-32"
              />
              <Button variant="primary" onClick={handleSellPriceSave} disabled={sellPriceSaving}>
                {sellPriceSaving ? 'שומר…' : 'שמור'}
              </Button>
            </div>
          </div>
        </Card>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="primary" onClick={() => setManualOrderModalOpen(true)}>
            Add Manual Order
          </Button>
          <Button variant="secondary" onClick={() => setAddBatchModalOpen(true)}>
            Add inventory batch
          </Button>
          <Button variant="secondary" onClick={() => setAdjustModalOpen(true)}>
            התאמת מלאי
          </Button>
        </div>
      </div>

      {/* KPIs + Export */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button variant="secondary" onClick={openExportModal}>
            Export Excel
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card className="p-4 text-center">
            <p className="text-xs text-[var(--muted)]">Inventory USDT</p>
            <p dir="ltr" className="mt-1 text-xl font-semibold text-[var(--text)]">
              {inventory?.usdt_balance ?? '—'}
            </p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-[var(--muted)]">Average Cost (ILS/USDT)</p>
            <p dir="ltr" className="mt-1 text-xl font-semibold text-[var(--text)]">
              {inventory?.avg_cost_ils_per_usdt != null
                ? parseFloat(inventory.avg_cost_ils_per_usdt.toFixed(3))
                : '—'}
            </p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-[var(--muted)]">Total Sold (USDT)</p>
            <p dir="ltr" className="mt-1 text-xl font-semibold text-[var(--text)]">
              {aggregates.totalSoldUsdt}
            </p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-[var(--muted)]">Total Profit (ILS)</p>
            <p dir="ltr" className="mt-1 text-xl font-semibold text-[var(--text)]">
              {aggregates.totalProfitIls.toFixed(2)}
            </p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-[var(--muted)]">Total Profit (USD)</p>
            <p dir="ltr" className="mt-1 text-xl font-semibold text-[var(--text)]">
              {aggregates.totalProfitUsd.toFixed(2)}
            </p>
          </Card>
        </div>
      </section>

      {/* Export Excel modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="relative w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text)]">
              ייצוא Excel — דוח רווחים
            </h3>
            <div className="space-y-4">
              <Input
                label="מתאריך"
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                dir="ltr"
              />
              <Input
                label="עד תאריך"
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                dir="ltr"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
                  סטטוס הזמנות
                </label>
                <select
                  value={exportStatus}
                  onChange={(e) => setExportStatus(e.target.value as 'completed' | 'all')}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg1)] px-4 py-2.5 text-[var(--text)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                >
                  <option value="completed">השלמות בלבד</option>
                  <option value="all">הכל</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="primary" onClick={handleExportDownload} disabled={exportDownloading}>
                {exportDownloading ? 'מוריד…' : 'הורד'}
              </Button>
              <Button variant="ghost" onClick={() => setExportModalOpen(false)} disabled={exportDownloading}>
                ביטול
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Adjust inventory modal */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="relative w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text)]">
              התאמת מלאי
            </h3>
            <p className="mb-4 text-sm text-amber-500/90">
              פעולה זו משפיעה על החשבונאות. השתמש בזהירות.
            </p>
            <div className="space-y-4">
              <Input
                label="כמות USDT (חיובי = הוספה, שלילי = הפחתה)"
                type="number"
                step="any"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="0"
                dir="ltr"
              />
              <Input
                label="הערה (חובה בהפחתה)"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder=""
              />
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="primary" onClick={handleAdjustInventory} disabled={adjustSaving}>
                {adjustSaving ? 'מעדכן…' : 'עדכן'}
              </Button>
              <Button variant="ghost" onClick={() => setAdjustModalOpen(false)} disabled={adjustSaving}>
                ביטול
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add batch modal */}
      {addBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="relative w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text)]">
              הוסף מקבץ מלאי
            </h3>
            <div className="space-y-4">
              <Input
                label="כמות USDT"
                type="number"
                step="any"
                min={0}
                value={batchAmount}
                onChange={(e) => setBatchAmount(e.target.value)}
                placeholder="0"
                dir="ltr"
              />
              <Input
                label="מחיר רכישה (₪/USDT)"
                type="number"
                step="any"
                min={0}
                value={batchPrice}
                onChange={(e) => setBatchPrice(e.target.value)}
                placeholder="0"
                dir="ltr"
              />
              <Input
                label="הערה (אופציונלי)"
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder=""
              />
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="primary" onClick={handleAddBatch} disabled={addBatchSaving}>
                {addBatchSaving ? 'מוסיף…' : 'הוסף'}
              </Button>
              <Button variant="ghost" onClick={() => setAddBatchModalOpen(false)} disabled={addBatchSaving}>
                ביטול
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Manual order modal */}
      {manualOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="relative w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text)]">
              Add Manual Order
            </h3>
            <div className="space-y-4">
              <Input
                label="Full name (required)"
                value={manualOrderFullName}
                onChange={(e) => setManualOrderFullName(e.target.value)}
                placeholder="Customer name"
              />
              <Input
                label="Phone (required)"
                value={manualOrderPhone}
                onChange={(e) => setManualOrderPhone(e.target.value)}
                placeholder="+972..."
                dir="ltr"
              />
              <Input
                label="עיר (חובה)"
                value={manualOrderCity}
                onChange={(e) => setManualOrderCity(e.target.value)}
                placeholder="תל אביב"
              />
              <Input
                label="Amount USDT (required)"
                type="number"
                step="any"
                min={0}
                value={manualOrderAmount}
                onChange={(e) => setManualOrderAmount(e.target.value)}
                placeholder="0"
                dir="ltr"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
                  Payment method
                </label>
                <select
                  value={manualOrderPaymentMethod}
                  onChange={(e) => setManualOrderPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg1)] px-4 py-2.5 text-[var(--text)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                >
                  {PAYMENT_OPTIONS.filter((o) => o.value !== '').map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Notes (optional)"
                value={manualOrderNotes}
                onChange={(e) => setManualOrderNotes(e.target.value)}
                placeholder=""
              />
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="primary" onClick={handleCreateManualOrder} disabled={manualOrderSaving}>
                {manualOrderSaving ? 'Creating…' : 'Create order'}
              </Button>
              <Button variant="ghost" onClick={() => setManualOrderModalOpen(false)} disabled={manualOrderSaving}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Complete modal */}
      {completeModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="relative w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text)]">
              Complete Order …{shortId(completeModalOrder.id)}
            </h3>
            <p className="mb-2 text-sm text-[var(--muted)]">
              Amount: <span dir="ltr">{completeModalOrder.amount_usdt} USDT</span>
            </p>
            <p className="mb-4 text-sm text-[var(--text)]">
              Sell Price: <span dir="ltr">{appSettings?.sell_price_ils_per_usdt ?? '—'} ILS/USDT</span>
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="primary" onClick={handleCompleteConfirm} disabled={completeSubmitting}>
                {completeSubmitting ? 'מבצע…' : 'אישור'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCompleteModalOrder(null)}
                disabled={completeSubmitting}
              >
                ביטול
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Orders section */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)]/60 pb-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">הזמנות</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">סינון וניהול הזמנות</p>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg1)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">אמצעי תשלום</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg1)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            >
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[var(--muted)]">טוען הזמנות…</p>
        ) : (
          <div className="mt-6 overflow-x-auto -mx-1">
            <table className="w-full min-w-[700px] border-collapse text-right">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="pb-3 pl-2 pr-3 text-xs font-medium text-[var(--muted)]">תאריך</th>
                  <th className="pb-3 pl-2 pr-3 text-xs font-medium text-[var(--muted)]">שם</th>
                  <th className="pb-3 pl-2 pr-3 text-xs font-medium text-[var(--muted)]">עיר</th>
                  <th className="pb-3 pl-2 pr-3 text-xs font-medium text-[var(--muted)]">USDT</th>
                  <th className="pb-3 pl-2 pr-3 text-xs font-medium text-[var(--muted)]">תשלום</th>
                  <th className="pb-3 pl-2 pr-3 text-xs font-medium text-[var(--muted)]">Status</th>
                  <th className="pb-3 pl-2 pr-3 text-xs font-medium text-[var(--muted)]">Order ID</th>
                  <th className="pb-3 pl-2 text-xs font-medium text-[var(--muted)]">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                      אין הזמנות
                    </td>
                  </tr>
                ) : (
                  orders.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)]/50">
                      <td className="py-3.5 pl-2 pr-3 text-sm text-[var(--text)]">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="py-3.5 pl-2 pr-3 text-sm text-[var(--text)]">
                        {row.full_name ?? '—'}
                      </td>
                      <td className="py-3.5 pl-2 pr-3 text-sm text-[var(--text)]">
                        {row.city ?? '—'}
                      </td>
                      <td dir="ltr" className="py-3.5 pl-2 pr-3 text-sm text-[var(--text)]">
                        {row.amount_usdt ?? '—'}
                      </td>
                      <td className="py-3.5 pl-2 pr-3 text-sm text-[var(--text)]">
                        {row.payment_method ?? '—'}
                      </td>
                      <td className="py-3.5 pl-2 pr-3 text-sm text-[var(--text)]">
                        {row.status ?? '—'}
                      </td>
                      <td dir="ltr" className="py-3.5 pl-2 pr-3 text-sm font-mono text-[var(--primary)]">
                        …{shortId(row.id)}
                      </td>
                      <td className="py-3.5 pl-2 text-sm">
                        {row.status === 'new' && (
                          <div className="flex flex-wrap gap-2 justify-start">
                            <Button
                              variant="primary"
                              className="!py-1.5 !px-3 !text-xs"
                              onClick={() => setCompleteModalOrder(row)}
                            >
                              Complete
                            </Button>
                            <Button
                              variant="ghost"
                              className="!py-1.5 !px-3 !text-xs"
                              onClick={() => handleCancelOrder(row)}
                              disabled={cancellingId === row.id}
                            >
                              {cancellingId === row.id ? '…' : 'Cancel'}
                            </Button>
                            <Button
                              variant="ghost"
                              className="!py-1.5 !px-3 !text-xs text-red-400 hover:text-red-300"
                              onClick={() => handleDeleteOrder(row)}
                              disabled={deletingId === row.id}
                            >
                              {deletingId === row.id ? '…' : 'Delete'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
