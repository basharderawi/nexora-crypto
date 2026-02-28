-- Rename orders.country to orders.city (no data loss)
ALTER TABLE public.orders RENAME COLUMN country TO city;
