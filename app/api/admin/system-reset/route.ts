import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabaseClient';
import { createClient as createServerClient } from '@/lib/supabase/server';

const CONFIRM_TEXT = 'DELETE_ALL_DATA_FOREVER';

const REQUIRED_ENVS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_EMAIL',
] as const;

function getMissingEnvs(): string[] {
  const missing: string[] = [];
  for (const name of REQUIRED_ENVS) {
    const val = process.env[name]?.trim();
    if (!val) missing.push(name);
  }
  return missing;
}

/** Lazy admin client – created only inside POST after env check (no module-level init). */
function getAdminClient() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const missing = getMissingEnvs();
    if (missing.length > 0) {
      console.error('[system-reset] missing envs:', missing);
      return NextResponse.json(
        { error: 'Server misconfiguration', missing },
        { status: 500 }
      );
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    if (user.email?.toLowerCase() !== adminEmail?.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const confirm = typeof body?.confirm === 'string' ? body.confirm : '';
    if (confirm !== CONFIRM_TEXT) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();

    // Read app_settings sell_price before deletes (for re-seed)
    const { data: existing } = await supabaseAdmin
      .from('app_settings')
      .select('sell_price_ils_per_usdt')
      .eq('id', 1)
      .maybeSingle();
    const sellPrice = (existing as { sell_price_ils_per_usdt?: number } | null)?.sell_price_ils_per_usdt;
    const sellVal = typeof sellPrice === 'number' && !Number.isNaN(sellPrice) ? sellPrice : 0;

    // (i) delete all inventory_ledger
    console.log('[system-reset] deleting inventory_ledger...');
    const { data: ledgerData, error: ledgerErr } = await supabaseAdmin
      .from('inventory_ledger')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    if (ledgerErr) {
      console.error('[system-reset] inventory_ledger delete error:', ledgerErr);
      return NextResponse.json({ error: 'DB error', message: ledgerErr.message }, { status: 500 });
    }
    const ledgerCount = Array.isArray(ledgerData) ? ledgerData.length : 0;

    // (ii) delete all orders
    console.log('[system-reset] deleting orders...');
    const { data: ordersData, error: ordersErr } = await supabaseAdmin
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    if (ordersErr) {
      console.error('[system-reset] orders delete error:', ordersErr);
      return NextResponse.json({ error: 'DB error', message: ordersErr.message }, { status: 500 });
    }
    const ordersCount = Array.isArray(ordersData) ? ordersData.length : 0;

    // (iii) delete all inventory_state
    console.log('[system-reset] deleting inventory_state...');
    const { data: stateData, error: stateErr } = await supabaseAdmin
      .from('inventory_state')
      .delete()
      .neq('id', -1)
      .select('id');
    if (stateErr) {
      console.error('[system-reset] inventory_state delete error:', stateErr);
      return NextResponse.json({ error: 'DB error', message: stateErr.message }, { status: 500 });
    }
    const stateCount = Array.isArray(stateData) ? stateData.length : 0;

    // (iv) delete all app_settings
    console.log('[system-reset] deleting app_settings...');
    const { error: appSettingsDeleteErr } = await supabaseAdmin
      .from('app_settings')
      .delete()
      .neq('id', -1);
    if (appSettingsDeleteErr) {
      console.error('[system-reset] app_settings delete error:', appSettingsDeleteErr);
      return NextResponse.json({ error: 'DB error', message: appSettingsDeleteErr.message }, { status: 500 });
    }

    // Re-seed inventory_state default row (id=1, balances 0)
    const { error: insertStateErr } = await supabaseAdmin.from('inventory_state').insert({
      id: 1,
      usdt_balance: 0,
      total_cost_ils: 0,
      avg_cost_ils_per_usdt: 0,
      updated_at: new Date().toISOString(),
    } as never);
    if (insertStateErr) {
      console.error('[system-reset] inventory_state insert error:', insertStateErr);
      return NextResponse.json({ error: 'DB error', message: insertStateErr.message }, { status: 500 });
    }

    // (v) ensure app_settings row id=1 exists
    const { error: upsertErr } = await supabaseAdmin
      .from('app_settings')
      .upsert(
        {
          id: 1,
          sell_price_ils_per_usdt: sellVal,
          buy_price_ils_per_usdt: 0,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'id' }
      );
    if (upsertErr) {
      console.error('[system-reset] app_settings upsert error:', upsertErr);
      return NextResponse.json({ error: 'DB error', message: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: { orders: ordersCount, ledger: ledgerCount, inventory_state: stateCount },
    });
  } catch (e) {
    console.error('[system-reset] error:', e);
    return NextResponse.json(
      {
        error: 'Reset failed',
        message: String((e as Error)?.message ?? e),
      },
      { status: 500 }
    );
  }
}
