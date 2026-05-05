
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS phone text;

INSERT INTO public.coupons (code, description, discount_type, discount_value, minimum_order_value, max_uses_per_customer, is_active, applicable_to_combos)
SELECT 'BEMVINDO10', 'Cupom de boas-vindas - 10% OFF na primeira compra', 'percentage', 10, 0, 1, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = 'BEMVINDO10');
