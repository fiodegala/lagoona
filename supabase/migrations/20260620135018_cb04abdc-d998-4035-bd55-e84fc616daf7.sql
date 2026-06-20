ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS applicable_to_promotional boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.coupons.applicable_to_promotional IS 'If false, coupon cannot be applied when cart contains promotional/discounted products.';