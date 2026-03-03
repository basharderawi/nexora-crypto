import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const sellOrderBodySchema = z.object({
  full_name: z.string().min(1, 'full_name required'),
  city: z.string().min(1, 'city required'),
  phone: z.string().min(1, 'phone required').refine((v) => v.replace(/\D/g, '').length >= 9, 'invalid phone'),
  amount_usdt: z.coerce.number().positive('amount_usdt must be positive'),
  payment_method: z.enum(['BIT', 'CASH_WITHOUT_CARD'], { required_error: 'payment_method required' }),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.error('SELL_ORDER_API_BODY', body);
    }
    const parsed = sellOrderBodySchema.safeParse(body);
    if (!parsed.success) {
      const flatten = parsed.error.flatten();
      return NextResponse.json(
        { error: 'Validation failed', ...flatten },
        { status: 400 }
      );
    }
    const { full_name, city, phone, amount_usdt, payment_method, notes } = parsed.data;

    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('buy_price_ils_per_usdt')
      .eq('id', 1)
      .maybeSingle();
    const buy_price_ils_per_usdt =
      (settingsRow as { buy_price_ils_per_usdt?: number } | null)?.buy_price_ils_per_usdt ?? 0;

    const { data: inserted, error } = await supabaseAdmin
      .from('orders')
      .insert([{
        full_name,
        city,
        phone,
        amount_usdt,
        payment_method,
        notes: notes ?? null,
        status: 'new',
        side: 'BUY',
        buy_price_ils_per_usdt,
      }] as any)
      .select()
      .single();

    if (error) {
      console.error('SELL_ORDER_INSERT_ERROR', error);
      return NextResponse.json(
        {
          error: 'DB insert failed',
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        { status: 500 }
      );
    }

    const id = (inserted as { id?: string } | null)?.id ?? null;
    if (!id) {
      return NextResponse.json(
        { error: 'Server error', message: 'Order created but no id returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({ id });
  } catch (e) {
    console.error('[api/sell-orders] error:', e);
    return NextResponse.json(
      {
        error: 'Server error',
        message: String((e as Error)?.message ?? e),
        stack: process.env.NODE_ENV === 'development' ? String((e as Error)?.stack ?? '') : undefined,
      },
      { status: 500 }
    );
  }
}
