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

    const { data, error } = await supabaseAdmin.rpc('admin_full_reset');
    if (error) {
      console.error('[api/admin/reset] rpc error:', error);
      return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
    }

    const result = data as { success?: boolean; error?: string } | null;
    if (result?.success !== true) {
      return NextResponse.json(
        { error: result?.error ?? 'Reset failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[api/admin/reset] error:', e);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
