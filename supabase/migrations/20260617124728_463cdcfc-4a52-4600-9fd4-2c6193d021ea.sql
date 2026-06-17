
-- 1) Hide wholesale_price and exclusive_price from anonymous visitors
REVOKE SELECT (wholesale_price, exclusive_price) ON public.products FROM anon;
REVOKE SELECT (wholesale_price, exclusive_price) ON public.product_variations FROM anon;

-- 2) Allow admin/manager to DELETE resumes from the private bucket
CREATE POLICY "Admin can delete resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resumes' AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Admin can update resumes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resumes' AND public.is_admin_or_manager(auth.uid()))
WITH CHECK (bucket_id = 'resumes' AND public.is_admin_or_manager(auth.uid()));

-- 3) Validate public INSERTs on score_predictions (anti-abuse)
DROP POLICY IF EXISTS "Anyone can submit a prediction" ON public.score_predictions;
CREATE POLICY "Anyone can submit a prediction"
ON public.score_predictions FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(full_name)) BETWEEN 2 AND 120
  AND length(trim(whatsapp)) BETWEEN 8 AND 20
  AND whatsapp ~ '^[0-9+()\-\s]+$'
  AND score_brasil BETWEEN 0 AND 99
  AND score_haiti  BETWEEN 0 AND 99
  AND (notes IS NULL OR length(notes) <= 500)
);

-- 4) Validate public INSERTs on newsletter_subscribers (anti-spam)
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe to newsletter"
ON public.newsletter_subscribers FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(email) BETWEEN 5 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);
