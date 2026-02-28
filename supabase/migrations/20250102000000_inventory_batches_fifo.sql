-- Smart inventory: batches by buy price, FIFO on complete_order
-- 1) inventory_batches: one row per distinct buy_price_ils_per_usdt (merge same price)
-- 2) inventory_ledger: add cost_ils, profit_ils, breakdown; allow type 'BUY'
-- 3) inventory_state: keep as aggregated snapshot (recomputed from batches in RPCs)
-- 4) add_inventory_batch RPC
-- 5) complete_order RPC rewritten for FIFO

-- Ensure inventory_state exists and has row id=1 (create if not)
CREATE TABLE IF NOT EXISTS public.inventory_state (
  id int PRIMARY KEY,
  usdt_balance numeric NOT NULL DEFAULT 0,
  total_cost_ils numeric NOT NULL DEFAULT 0,
  avg_cost_ils_per_usdt numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.inventory_state (id, usdt_balance, total_cost_ils, avg_cost_ils_per_usdt)
VALUES (1, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Ensure inventory_ledger exists and add columns (create if not)
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  amount_usdt numeric NOT NULL,
  price_ils_per_usdt numeric,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.inventory_ledger
  ADD COLUMN IF NOT EXISTS cost_ils numeric,
  ADD COLUMN IF NOT EXISTS profit_ils numeric,
  ADD COLUMN IF NOT EXISTS breakdown jsonb;

-- Allow BUY in ledger type (no strict enum; if you use check, alter it)
-- Assuming type is plain text; if constraint exists: ALTER TABLE inventory_ledger DROP CONSTRAINT IF EXISTS inventory_ledger_type_check;
-- ALTER TABLE inventory_ledger ADD CONSTRAINT inventory_ledger_type_check CHECK (type IN ('INIT','BUY','SELL'));

-- inventory_batches: one row per buy price (same price = merge)
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id bigserial PRIMARY KEY,
  buy_price_ils_per_usdt numeric NOT NULL,
  amount_usdt numeric NOT NULL CHECK (amount_usdt >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buy_price_ils_per_usdt)
);

-- RLS: authenticated can manage batches (admin only from UI)
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_batches_authenticated_all"
  ON public.inventory_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- add_inventory_batch: add stock at a buy price (merge if same price)
CREATE OR REPLACE FUNCTION add_inventory_batch(
  p_amount_usdt numeric,
  p_buy_price numeric,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_cost_ils numeric;
  v_avg numeric;
BEGIN
  IF p_amount_usdt IS NULL OR p_amount_usdt <= 0 OR p_buy_price IS NULL OR p_buy_price < 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid amount or price');
  END IF;

  -- Upsert batch: same price -> add amount
  INSERT INTO inventory_batches (buy_price_ils_per_usdt, amount_usdt)
  VALUES (p_buy_price, p_amount_usdt)
  ON CONFLICT (buy_price_ils_per_usdt)
  DO UPDATE SET
    amount_usdt = inventory_batches.amount_usdt + EXCLUDED.amount_usdt,
    updated_at = now();

  -- Ledger BUY
  INSERT INTO inventory_ledger (type, amount_usdt, price_ils_per_usdt, note)
  VALUES ('BUY', p_amount_usdt, p_buy_price, COALESCE(p_note, 'add_inventory_batch'));

  -- Recompute inventory_state from batches
  SELECT COALESCE(SUM(amount_usdt), 0), COALESCE(SUM(amount_usdt * buy_price_ils_per_usdt), 0)
    INTO v_total, v_cost_ils
    FROM inventory_batches;
  v_avg := CASE WHEN v_total > 0 THEN v_cost_ils / v_total ELSE 0 END;

  UPDATE inventory_state
  SET usdt_balance = v_total, total_cost_ils = v_cost_ils, avg_cost_ils_per_usdt = v_avg, updated_at = now()
  WHERE id = 1;

  RETURN json_build_object('ok', true);
END;
$$;

-- complete_order: FIFO consumption from batches
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
  v_amount numeric;
  v_remaining numeric;
  v_batch RECORD;
  v_take numeric;
  v_cost_ils numeric := 0;
  v_sell_ils numeric;
  v_profit_ils numeric;
  v_profit_usd numeric;
  v_breakdown jsonb := '[]'::jsonb;
  v_total_balance numeric;
BEGIN
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

  SELECT COALESCE(SUM(amount_usdt), 0) INTO v_total_balance FROM inventory_batches FOR UPDATE;
  IF v_total_balance < v_amount THEN
    RETURN json_build_object('ok', false, 'error', 'Insufficient inventory balance');
  END IF;

  v_remaining := v_amount;

  -- Consume FIFO (batches ordered by created_at ASC)
  FOR v_batch IN
    SELECT id, buy_price_ils_per_usdt, amount_usdt FROM inventory_batches ORDER BY created_at ASC FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_batch.amount_usdt, v_remaining);
    IF v_take <= 0 THEN CONTINUE; END IF;

    v_cost_ils := v_cost_ils + (v_take * v_batch.buy_price_ils_per_usdt);
    v_breakdown := v_breakdown || jsonb_build_object(
      'batch_id', v_batch.id, 'amount_usdt', v_take, 'price_ils_per_usdt', v_batch.buy_price_ils_per_usdt
    );

    UPDATE inventory_batches SET amount_usdt = amount_usdt - v_take, updated_at = now() WHERE id = v_batch.id;
    DELETE FROM inventory_batches WHERE id = v_batch.id AND amount_usdt <= 0;

    v_remaining := v_remaining - v_take;
  END LOOP;

  v_sell_ils := p_sell_price * v_amount;
  v_profit_ils := v_sell_ils - v_cost_ils;
  v_profit_usd := CASE WHEN p_usd_ils_rate IS NOT NULL AND p_usd_ils_rate > 0
    THEN v_profit_ils / p_usd_ils_rate ELSE NULL END;

  UPDATE orders
  SET
    status = 'completed',
    completed_at = now(),
    sell_price_ils_per_usdt = p_sell_price,
    buy_avg_cost_ils_per_usdt = CASE WHEN v_amount > 0 THEN v_cost_ils / v_amount ELSE 0 END,
    profit_ils = v_profit_ils,
    profit_usd = v_profit_usd,
    usd_ils_rate = p_usd_ils_rate,
    handled_by = auth.uid()
  WHERE id = p_order_id;

  INSERT INTO inventory_ledger (type, amount_usdt, price_ils_per_usdt, cost_ils, profit_ils, breakdown, note)
  VALUES ('SELL', v_amount, p_sell_price, v_cost_ils, v_profit_ils, v_breakdown, 'order:' || p_order_id::text);

  -- Recompute inventory_state from remaining batches
  UPDATE inventory_state s
  SET
    usdt_balance = agg.tot,
    total_cost_ils = agg.cost,
    avg_cost_ils_per_usdt = CASE WHEN agg.tot > 0 THEN agg.cost / agg.tot ELSE 0 END,
    updated_at = now()
  FROM (
    SELECT COALESCE(SUM(amount_usdt), 0) AS tot, COALESCE(SUM(amount_usdt * buy_price_ils_per_usdt), 0) AS cost
    FROM inventory_batches
  ) agg
  WHERE s.id = 1;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION add_inventory_batch(numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_order(uuid, numeric, numeric) TO anon;
GRANT EXECUTE ON FUNCTION complete_order(uuid, numeric, numeric) TO authenticated;
