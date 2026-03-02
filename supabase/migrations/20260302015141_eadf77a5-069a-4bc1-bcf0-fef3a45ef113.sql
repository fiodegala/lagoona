
-- Add column to store the recovery coupon code sent to the customer
ALTER TABLE public.abandoned_carts ADD COLUMN recovery_coupon_code text;
