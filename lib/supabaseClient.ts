import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** app_settings table shape for typed updates */
export type AppSettingsTable = {
  Row: { id: number; sell_price_ils_per_usdt: number; updated_at: string };
  Insert: { id?: number; sell_price_ils_per_usdt: number; updated_at?: string };
  Update: { sell_price_ils_per_usdt?: number; updated_at?: string };
  Relationships: { foreignKeyName: string; columns: string[]; referencedRelation: string; referencedColumns: string[] }[];
};

/** orders table – minimal Insert for manual order and public form */
export type OrdersTable = {
  Row: Record<string, unknown>;
  Insert: {
    full_name: string;
    phone: string;
    city: string;
    amount_usdt: number;
    payment_method: string;
    notes?: string | null;
    status: string;
    sell_price_ils_per_usdt?: number | null;
  };
  Update: Record<string, unknown>;
  Relationships: { foreignKeyName: string; columns: string[]; referencedRelation: string; referencedColumns: string[] }[];
};

/** RPC function signatures so .rpc() accepts typed payloads */
export type DatabaseFunctions = {
  add_inventory_batch: {
    Args: { p_amount_usdt: number; p_buy_price: number; p_note?: string | null };
    Returns: unknown;
  };
  adjust_inventory: {
    Args: { p_amount_usdt: number; p_note?: string | null };
    Returns: unknown;
  };
  cancel_order: {
    Args: { p_order_id: string; p_note?: string | null };
    Returns: unknown;
  };
  complete_order: {
    Args: { p_order_id: string; p_sell_price: number; p_usd_ils_rate: number | null };
    Returns: unknown;
  };
  reset_all_data: {
    Args: Record<string, never>;
    Returns: unknown;
  };
  admin_full_reset: {
    Args: Record<string, never>;
    Returns: unknown;
  };
};

/** Extend this with your database schema types when ready */
export type Database = {
  public: {
    Tables: {
      app_settings: AppSettingsTable;
      orders: OrdersTable;
      [key: string]: unknown;
    };
    Views: Record<string, unknown>;
    Functions: DatabaseFunctions;
    Enums: Record<string, unknown>;
  };
};

function getSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient<Database>(url, key);
}

/** Single shared client – safe to use in both client and server components */
export const supabase: SupabaseClient<Database> = getSupabaseClient();
