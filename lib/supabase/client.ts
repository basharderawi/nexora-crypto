import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabaseClient';

/**
 * Browser Supabase client using cookies (SSR-compatible).
 * Use in admin and any client component that needs auth so middleware and server can see the session.
 * persistSession is true by default – do not set to false.
 */
function getBrowserClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  // Session stored in cookies by default – do not set persistSession: false
  return createBrowserClient<Database>(url, key) as SupabaseClient<Database>;
}

export const supabase = getBrowserClient();
