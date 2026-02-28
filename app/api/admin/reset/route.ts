import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/lib/supabaseClient';

export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

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
    if (userErr || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase.rpc('reset_all_data');
    if (error) {
      const msg = (error as { message?: string }).message ?? error?.message ?? 'Reset failed';
      return NextResponse.json(
        { error: msg },
        { status: 400 }
      );
    }
    const result = data as { ok?: boolean; error?: string } | null;
    if (result?.ok === false) {
      return NextResponse.json(
        { error: result.error ?? 'Reset failed' },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Reset failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
