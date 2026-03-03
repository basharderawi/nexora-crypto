-- Buy-from-customer flow: orders.side + buy_price_ils_per_usdt, app_settings.buy_price_ils_per_usdt

-- 1) orders: side (sell_to_customer | buy_from_customer), buy_price_ils_per_usdt snapshot
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS side text NOT NULL DEFAULT 'sell_to_customer',
  ADD COLUMN IF NOT EXISTS buy_price_ils_per_usdt numeric NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_side_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_side_check CHECK (side IN ('sell_to_customer', 'buy_from_customer'));

-- Backfill existing rows (default already applied by ADD COLUMN DEFAULT)
UPDATE public.orders SET side = 'sell_to_customer' WHERE side IS NULL;

-- 2) app_settings: buy price (ILS per 1 USDT we pay when customer sells to us)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS buy_price_ils_per_usdt numeric NOT NULL DEFAULT 0;

UPDATE public.app_settings SET buy_price_ils_per_usdt = 0 WHERE id = 1 AND buy_price_ils_per_usdt IS NULL;
