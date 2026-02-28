-- complete_order: weighted average cost basis (no batches/FIFO)
-- Uses inventory_state only: usdt_balance, total_cost_ils, avg_cost_ils_per_usdt

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
  v_state RECORD;
  v_amount numeric;
  v_sell_ils numeric;
  v_cost_ils numeric;
  v_profit_ils numeric;
  v_profit_usd numeric;
  v_new_balance numeric;
  v_new_total_cost numeric;
  v_new_avg numeric;
BEGIN
  -- Lock order, ensure status = 'new'
  SELECT id, amount_usdt, status INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
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

  -- Lock inventory_state (id=1)
  SELECT id, usdt_balance, total_cost_ils, avg_cost_ils_per_usdt
    INTO v_state
    FROM inventory_state
    WHERE id = 1
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Inventory state not found');
  END IF;
  IF v_state.usdt_balance < v_amount THEN
    RETURN json_build_object('ok', false, 'error', 'Insufficient inventory balance');
  END IF;

  -- Cost and profit using weighted average at time of sale
  v_sell_ils := p_sell_price * v_amount;
  v_cost_ils := v_state.avg_cost_ils_per_usdt * v_amount;
  v_profit_ils := v_sell_ils - v_cost_ils;
  v_profit_usd := CASE WHEN p_usd_ils_rate IS NOT NULL AND p_usd_ils_rate > 0
    THEN v_profit_ils / p_usd_ils_rate ELSE NULL END;

  -- New inventory_state values
  v_new_balance := v_state.usdt_balance - v_amount;
  v_new_total_cost := v_state.total_cost_ils - v_cost_ils;

  -- Clamp tiny negatives
  IF v_new_total_cost < 0 AND abs(v_new_total_cost) < 0.000001 THEN
    v_new_total_cost := 0;
  END IF;

  -- If balance zero, force total cost and avg to 0 (avoid rounding)
  IF v_new_balance <= 0 THEN
    v_new_balance := 0;
    v_new_total_cost := 0;
    v_new_avg := 0;
  ELSE
    v_new_avg := v_new_total_cost / v_new_balance;
  END IF;

  UPDATE inventory_state
  SET
    usdt_balance = v_new_balance,
    total_cost_ils = v_new_total_cost,
    avg_cost_ils_per_usdt = v_new_avg,
    updated_at = now()
  WHERE id = 1;

  UPDATE orders
  SET
    status = 'completed',
    completed_at = now(),
    sell_price_ils_per_usdt = p_sell_price,
    buy_avg_cost_ils_per_usdt = v_state.avg_cost_ils_per_usdt,
    profit_ils = v_profit_ils,
    profit_usd = v_profit_usd,
    usd_ils_rate = p_usd_ils_rate
  WHERE id = p_order_id;

  INSERT INTO inventory_ledger (type, amount_usdt, price_ils_per_usdt, cost_ils, profit_ils, breakdown, note)
  VALUES (
    'SELL',
    v_amount,
    p_sell_price,
    v_cost_ils,
    v_profit_ils,
    jsonb_build_object('cost_ils', v_cost_ils, 'profit_ils', v_profit_ils),
    'order:' || p_order_id::text || ' cost_ils:' || v_cost_ils::text || ' profit_ils:' || v_profit_ils::text
  );

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION complete_order(uuid, numeric, numeric) TO authenticated;
-- anon often used for public checkout; add back if your API calls complete_order as anon
-- GRANT EXECUTE ON FUNCTION complete_order(uuid, numeric, numeric) TO anon;
