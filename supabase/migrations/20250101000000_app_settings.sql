-- Table: public.app_settings (single row id=1 for current sell price)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id int PRIMARY KEY,
  sell_price_ils_per_usdt numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Initial row
INSERT INTO public.app_settings (id, sell_price_ils_per_usdt)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- anon: SELECT only
CREATE POLICY "app_settings_anon_select"
  ON public.app_settings
  FOR SELECT
  TO anon
  USING (true);

-- authenticated: SELECT and UPDATE only (no INSERT/DELETE)
CREATE POLICY "app_settings_authenticated_select"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "app_settings_authenticated_update"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
