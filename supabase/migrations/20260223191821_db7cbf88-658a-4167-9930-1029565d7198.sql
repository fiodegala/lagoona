
-- Add tracking fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS tracking_code text,
ADD COLUMN IF NOT EXISTS tracking_url text,
ADD COLUMN IF NOT EXISTS shipping_carrier text,
ADD COLUMN IF NOT EXISTS shipped_at timestamp with time zone;
