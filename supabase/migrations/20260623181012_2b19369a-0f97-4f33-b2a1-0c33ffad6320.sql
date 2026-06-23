-- Enforce: free_shipping_min_value must be NULL or >= 499 (R$ 499,00)
-- Also enforce sane numeric constraints on shipping_zones

ALTER TABLE public.shipping_zones
  DROP CONSTRAINT IF EXISTS shipping_zones_free_shipping_min_value_check;

ALTER TABLE public.shipping_zones
  ADD CONSTRAINT shipping_zones_free_shipping_min_value_check
  CHECK (free_shipping_min_value IS NULL OR free_shipping_min_value >= 499);

ALTER TABLE public.shipping_zones
  DROP CONSTRAINT IF EXISTS shipping_zones_base_price_check;
ALTER TABLE public.shipping_zones
  ADD CONSTRAINT shipping_zones_base_price_check CHECK (base_price >= 0);

ALTER TABLE public.shipping_zones
  DROP CONSTRAINT IF EXISTS shipping_zones_price_per_kg_check;
ALTER TABLE public.shipping_zones
  ADD CONSTRAINT shipping_zones_price_per_kg_check CHECK (price_per_kg >= 0);

ALTER TABLE public.shipping_zones
  DROP CONSTRAINT IF EXISTS shipping_zones_days_check;
ALTER TABLE public.shipping_zones
  ADD CONSTRAINT shipping_zones_days_check
  CHECK (estimated_days_min >= 1 AND estimated_days_max >= estimated_days_min);

ALTER TABLE public.shipping_zones
  DROP CONSTRAINT IF EXISTS shipping_zones_zip_range_check;
ALTER TABLE public.shipping_zones
  ADD CONSTRAINT shipping_zones_zip_range_check
  CHECK (length(zip_start) = 8 AND length(zip_end) = 8 AND zip_start <= zip_end);

COMMENT ON CONSTRAINT shipping_zones_free_shipping_min_value_check ON public.shipping_zones
  IS 'Frete grátis só pode ser configurado a partir de R$ 499,00 (regra de negócio global).';