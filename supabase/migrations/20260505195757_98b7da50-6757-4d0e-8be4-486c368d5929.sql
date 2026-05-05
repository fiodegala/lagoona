CREATE UNIQUE INDEX IF NOT EXISTS coupon_usage_coupon_order_unique
ON public.coupon_usage (coupon_id, order_id)
WHERE order_id IS NOT NULL;