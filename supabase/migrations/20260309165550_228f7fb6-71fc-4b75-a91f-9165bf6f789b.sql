
CREATE OR REPLACE FUNCTION public.increment_affiliate_clicks(ref_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.affiliates SET clicks = clicks + 1 WHERE referral_code = ref_code AND status = 'active';
END;
$$;
