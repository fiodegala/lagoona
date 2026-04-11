ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS video_url text;