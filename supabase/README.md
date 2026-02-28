# Supabase

## Migrations

Apply migrations in order (by filename) via Supabase SQL Editor or `supabase db push`:

- **20250101000000_app_settings.sql** – `app_settings` table and RLS (sell price).
- **20250102000000_inventory_batches_fifo.sql** – Smart inventory:
  - `inventory_batches` (one row per buy price, merge same price).
  - `inventory_ledger`: optional columns `cost_ils`, `profit_ils`, `breakdown`; type may include `BUY`.
  - `inventory_state` ensured (id=1); aggregated snapshot recomputed in RPCs.
  - **add_inventory_batch(p_amount_usdt, p_buy_price, p_note)** – add/merge batch, ledger BUY, recompute state.
  - **complete_order(p_order_id, p_sell_price, p_usd_ils_rate)** – FIFO consumption from batches, ledger SELL with cost/profit/breakdown, recompute state.

Ensure `orders` has: `completed_at`, `sell_price_ils_per_usdt`, `buy_avg_cost_ils_per_usdt`, `profit_ils`, `profit_usd`, `usd_ils_rate`; optional `handled_by` (uuid). If `handled_by` is missing, remove that line from the `complete_order` function in the migration.

## Legacy: complete_order_rpc.sql

The standalone `complete_order_rpc.sql` is superseded by the FIFO implementation in **20250102000000_inventory_batches_fifo.sql**. Use the migration for batch-based inventory and FIFO cost.
