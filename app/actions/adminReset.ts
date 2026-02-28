'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

const CONFIRM_TEXT = 'DELETE_ALL_DATA_FOREVER';

export async function triggerAdminReset(confirmText: string): Promise<{ success: boolean; error?: string }> {
  if (confirmText !== CONFIRM_TEXT) {
    return { success: false, error: 'Invalid confirmation' };
  }
  try {
    const { data, error } = await supabaseAdmin.rpc('admin_full_reset');
    if (error) {
      console.error('[adminReset] rpc error:', error);
      return { success: false, error: error.message ?? 'Reset failed' };
    }
    const result = data as { success?: boolean; error?: string } | null;
    if (result?.success !== true) {
      return { success: false, error: result?.error ?? 'Reset failed' };
    }
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Reset failed';
    console.error('[adminReset] error:', e);
    return { success: false, error: message };
  }
}
