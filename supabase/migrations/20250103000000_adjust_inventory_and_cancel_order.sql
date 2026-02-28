-- Safe inventory/order corrections (no hard deletes)
-- 1) adjust_inventory: atomic adjustment of inventory_state + ledger type ADJUST
-- 2) cancel_order: soft cancel (status=cancelled, cancelled_at=now())

-- adjust_inventory: lock state, ensure balance >= 0 for negative adj, update state, insert ADJUST ledger row
CREATE OR REPLACE FUNCTION adjust_inventory(
  p_amount_usdt numeric,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_new_balance numeric;
  v_new_cost numeric;
  v_avg numeric;
BEGIN
  IF p_amount_usdt IS NULL OR p_amount_usdt = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Amount must be non-zero');
  END IF;

  IF p_amount_usdt < 0 AND (p_note IS NULL OR trim(p_note) = '') THEN
    RETURN json_build_object('ok', false, 'error', 'Note is required for negative adjustments');
  END IF;

  -- Lock inventory_state (id=1) for update
  SELECT id, usdt_balance, total_cost_ils, avg_cost_ils_per_usdt
    INTO v_row
    FROM inventory_state
    WHERE id = 1
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Inventory state not found');
  END IF;

  v_new_balance := v_row.usdt_balance + p_amount_usdt;

  IF v_new_balance < 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Resulting balance would be negative');
  END IF;

  v_avg := v_row.avg_cost_ils_per_usdt;

  IF p_amount_usdt > 0 THEN
    -- Adding: increase total_cost_ils proportionally (at current avg)
    v_new_cost := v_row.total_cost_ils + (p_amount_usdt * v_avg);
  ELSE
    -- Reducing: reduce total_cost_ils by current avg (keeps avg stable)
    v_new_cost := v_row.total_cost_ils + (p_amount_usdt * v_avg);  -- p_amount_usdt is negative
  END IF;

  -- Recompute avg (avoid div by zero when balance becomes 0)
  v_avg := CASE WHEN v_new_balance > 0 THEN v_new_cost / v_new_balance ELSE 0 END;

  UPDATE inventory_state
  SET
    usdt_balance = v_new_balance,
    total_cost_ils = v_new_cost,
    avg_cost_ils_per_usdt = v_avg,
    updated_at = now()
  WHERE id = 1;

  -- Ledger row: ADJUST with current avg as price
  INSERT INTO inventory_ledger (type, amount_usdt, price_ils_per_usdt, note)
  VALUES ('ADJUST', p_amount_usdt, v_row.avg_cost_ils_per_usdt, COALESCE(trim(nullif(p_note, '')), 'adjust_inventory'));

  RETURN json_build_object('ok', true);
END;
$$;

-- cancel_order: soft delete (status=cancelled, cancelled_at=now())
CREATE OR REPLACE FUNCTION cancel_order(
  p_order_id uuid,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, status INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Order not found');
  END IF;

  IF v_order.status != 'new' THEN
    RETURN json_build_object('ok', false, 'error', 'Only new orders can be cancelled');
  END IF;

  UPDATE orders
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_inventory(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_order(uuid, text) TO authenticated;
