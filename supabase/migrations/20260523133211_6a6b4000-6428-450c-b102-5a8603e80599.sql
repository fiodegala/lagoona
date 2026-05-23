ALTER TABLE public.product_variations
  ADD COLUMN IF NOT EXISTS visible_site boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_pdv boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_catalog boolean NOT NULL DEFAULT true;