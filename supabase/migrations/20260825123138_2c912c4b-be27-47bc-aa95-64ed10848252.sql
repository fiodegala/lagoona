ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_discount_type_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_discount_type_check CHECK (discount_type = ANY (ARRAY['percentage','fixed','free_shipping','shipping_fixed','shipping_percentage','progressive']));
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_discount_value_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_discount_value_check CHECK (
  discount_value >= 0 AND (
    discount_value > 0
    OR discount_type = ANY (ARRAY['free_shipping','progressive'])
  )
);