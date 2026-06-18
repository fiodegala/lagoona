
-- 1) Tighten affiliates public INSERT with basic validation
DROP POLICY IF EXISTS "Anyone can sign up as affiliate" ON public.affiliates;
CREATE POLICY "Anyone can sign up as affiliate"
ON public.affiliates
FOR INSERT
TO public
WITH CHECK (
  status = 'pending'
  AND balance_pending = 0
  AND balance_available = 0
  AND clicks = 0
  AND name IS NOT NULL AND char_length(btrim(name)) BETWEEN 2 AND 120
  AND email IS NOT NULL AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(email) <= 255
  AND (phone IS NULL OR char_length(phone) <= 30)
  AND (document IS NULL OR char_length(document) <= 30)
  AND referral_code IS NOT NULL AND char_length(referral_code) BETWEEN 3 AND 60
  AND (pix_key IS NULL OR char_length(pix_key) <= 120)
  AND (bank_name IS NULL OR char_length(bank_name) <= 120)
  AND (bank_agency IS NULL OR char_length(bank_agency) <= 30)
  AND (bank_account IS NULL OR char_length(bank_account) <= 60)
  AND (notes IS NULL OR char_length(notes) <= 1000)
);

-- 2) Tighten coupon_usage public INSERT
DROP POLICY IF EXISTS "Anyone can create coupon usage" ON public.coupon_usage;
CREATE POLICY "Anyone can create coupon usage"
ON public.coupon_usage
FOR INSERT
TO public
WITH CHECK (
  coupon_id IS NOT NULL
  AND discount_applied IS NOT NULL
  AND discount_applied >= 0
  AND discount_applied <= 100000
  AND (customer_email IS NULL OR (
    customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND char_length(customer_email) <= 255
  ))
);

-- 3) Tighten orders public INSERT with format validation
DROP POLICY IF EXISTS "Anyone can create orders via checkout" ON public.orders;
CREATE POLICY "Anyone can create orders via checkout"
ON public.orders
FOR INSERT
TO public
WITH CHECK (
  customer_email IS NOT NULL
  AND customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND char_length(customer_email) <= 255
  AND customer_name IS NOT NULL
  AND char_length(btrim(customer_name)) BETWEEN 2 AND 200
  AND total IS NOT NULL AND total >= 0 AND total <= 1000000
  AND status IN ('pending','confirmed')
  AND (payment_status IS NULL OR payment_status IN ('pending','paid','failed','refunded'))
);

-- 4) Revoke wholesale/exclusive price columns from anon/authenticated
REVOKE SELECT (wholesale_price, exclusive_price) ON public.products FROM anon, authenticated;
REVOKE SELECT (wholesale_price, exclusive_price) ON public.product_variations FROM anon, authenticated;
