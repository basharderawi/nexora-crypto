import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PAYMENT_METHODS = ['BIT', 'CASH_WITHOUT_CARD'] as const;

function parseBody(body: unknown): {
  full_name: string;
  city: string;
  phone: string;
  amount_usdt: number;
  payment_method: string;
  notes?: string | null;
} | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const full_name = typeof o.full_name === 'string' ? o.full_name.trim() : '';
  const city = typeof o.city === 'string' ? o.city.trim() : '';
  const phone = typeof o.phone === 'string' ? o.phone.trim() : '';
  const amount_usdt = typeof o.amount_usdt === 'number' ? o.amount_usdt : Number(o.amount_usdt);
  const payment_method = typeof o.payment_method === 'string' ? o.payment_method : '';
  const notes = o.notes == null ? null : typeof o.notes === 'string' ? o.notes.trim() || null : null;

  if (!full_name || !city || !phone) return null;
  if (Number.isNaN(amount_usdt) || amount_usdt <= 0) return null;
  if (!PAYMENT_METHODS.includes(payment_method as (typeof PAYMENT_METHODS)[number])) return null;

  return { full_name, city, phone, amount_usdt, payment_method, notes };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseBody(body);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('sell_price_ils_per_usdt')
      .eq('id', 1)
      .maybeSingle();
    const sell_price_ils_per_usdt =
      (settingsRow as { sell_price_ils_per_usdt?: number } | null)?.sell_price_ils_per_usdt ?? null;

    const { data: inserted, error } = await supabaseAdmin
      .from('orders')
      .insert([{
        full_name: parsed.full_name,
        city: parsed.city,
        phone: parsed.phone,
        amount_usdt: parsed.amount_usdt,
        payment_method: parsed.payment_method,
        notes: parsed.notes ?? null,
        status: 'new',
        sell_price_ils_per_usdt,
      }] as any)
      .select()
      .single();

    if (error) {
      console.error('[api/orders] insert error:', error);
      return NextResponse.json({ error: 'Order creation failed' }, { status: 500 });
    }

    const id = (inserted as { id?: string } | null)?.id ?? null;
    if (!id) {
      return NextResponse.json({ error: 'Order creation failed' }, { status: 500 });
    }

    return NextResponse.json({ id });
  } catch (e) {
    console.error('[api/orders] error:', e);
    return NextResponse.json({ error: 'Order creation failed' }, { status: 500 });
  }
}
