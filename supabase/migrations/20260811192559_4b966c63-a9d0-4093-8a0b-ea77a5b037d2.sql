ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_campaign boolean NOT NULL DEFAULT false;
ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS is_campaign boolean NOT NULL DEFAULT false;