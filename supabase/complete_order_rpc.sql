-- Complete order RPC: atomic update of order + inventory_state + inventory_ledger
-- Run this in Supabase SQL Editor (or via migration) to create the function.
-- Requires: orders (id, amount_usdt, status, completed_at, sell_price_ils_per_usdt,
--   buy_avg_cost_ils_per_usdt, profit_ils, profit_usd, usd_ils_rate; optional: handled_by),
--   inventory_state (id, usdt_balance, total_cost_ils, avg_cost_ils_per_usdt, updated_at),
--   inventory_ledger (type, amount_usdt, price_ils_per_usdt, note, ...).

CREATE OR REPLACE FUNCTION complete_order(
  p_order_id uuid,
  p_sell_price numeric,
  p_usd_ils_rate numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_inv RECORD;
  v_profit_ils numeric;
  v_profit_usd numeric;
  v_amount numeric;
  v_avg_cost numeric;
BEGIN
  -- a) Read order and lock it
  SELECT id, amount_usdt, status
    INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Order not found');
  END IF;

  IF v_order.status != 'new' THEN
    RETURN json_build_object('ok', false, 'error', 'Order is not in new status');
  END IF;

  v_amount := v_order.amount_usdt;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid order amount');
  END IF;

  -- b) Read inventory_state (id=1) FOR UPDATE
  SELECT id, usdt_balance, total_cost_ils, avg_cost_ils_per_usdt
    INTO v_inv
    FROM inventory_state
    WHERE id = 1
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Inventory state not found');
  END IF;

  IF COALESCE(v_inv.usdt_balance, 0) < v_amount THEN
    RETURN json_build_object('ok', false, 'error', 'Insufficient inventory balance');
  END IF;

  v_avg_cost := COALESCE(v_inv.avg_cost_ils_per_usdt, 0);

  -- d) profit_ils = (sell_price - avg_cost) * amount_usdt
  v_profit_ils := (p_sell_price - v_avg_cost) * v_amount;

  -- e) profit_usd = profit_ils / usd_ils_rate
  IF p_usd_ils_rate IS NOT NULL AND p_usd_ils_rate > 0 THEN
    v_profit_usd := v_profit_ils / p_usd_ils_rate;
  ELSE
    v_profit_usd := NULL;
  END IF;

  -- f) Update order (handled_by from auth.uid() when called by authenticated user)
  UPDATE orders
  SET
    status = 'completed',
    completed_at = now(),
    sell_price_ils_per_usdt = p_sell_price,
    buy_avg_cost_ils_per_usdt = v_avg_cost,
    profit_ils = v_profit_ils,
    profit_usd = v_profit_usd,
    usd_ils_rate = p_usd_ils_rate,
    handled_by = auth.uid()
  WHERE id = p_order_id;

  -- g) Update inventory_state
  IF v_inv.usdt_balance - v_amount <= 0 THEN
    UPDATE inventory_state
    SET
      usdt_balance = 0,
      total_cost_ils = 0,
      avg_cost_ils_per_usdt = 0,
      updated_at = now()
    WHERE id = 1;
  ELSE
    UPDATE inventory_state
    SET
      usdt_balance = usdt_balance - v_amount,
      total_cost_ils = total_cost_ils - (v_avg_cost * v_amount),
      updated_at = now()
    WHERE id = 1;
  END IF;

  -- h) Insert inventory_ledger SELL row
  INSERT INTO inventory_ledger (type, amount_usdt, price_ils_per_usdt, note)
  VALUES ('SELL', v_amount, p_sell_price, 'order:' || p_order_id::text);

  RETURN json_build_object('ok', true);
END;
$$;

-- Allow authenticated users to call the function (RLS does not apply to functions;
-- use SECURITY DEFINER so the function runs with definer rights and can update tables).
-- Grant execute to anon and authenticated so the Supabase client can call it.
GRANT EXECUTE ON FUNCTION complete_order(uuid, numeric, numeric) TO anon;
GRANT EXECUTE ON FUNCTION complete_order(uuid, numeric, numeric) TO authenticated;
