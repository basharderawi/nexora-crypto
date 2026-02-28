import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabaseClient';

/**
 * Server-only Supabase client with service role key.
 * Bypasses RLS. Use only in API routes or server code — never expose to the client.
 */
function getSupabaseAdmin(): ReturnType<typeof createClient<Database>> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const supabaseAdmin = getSupabaseAdmin();
