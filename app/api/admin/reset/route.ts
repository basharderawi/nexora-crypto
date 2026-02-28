import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const CONFIRM_TEXT = 'DELETE_ALL_DATA_FOREVER';

export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const headerSecret = request.headers.get('x-admin-secret');
    if (headerSecret !== adminSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const confirm = typeof body?.confirm === 'string' ? body.confirm : '';
    if (confirm !== CONFIRM_TEXT) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await supabaseAdmin.from('orders').delete().neq('id', null as never);
    await supabaseAdmin.from('inventory_state').delete().neq('id', null as never);
    await supabaseAdmin.from('inventory_ledger').delete().neq('id', null as never);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[api/admin/reset] error:', e);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
