-- 1) Revoke public (anon) access to wholesale_price and exclusive_price columns
REVOKE SELECT (wholesale_price, exclusive_price) ON public.products FROM anon;
REVOKE SELECT (wholesale_price, exclusive_price) ON public.product_variations FROM anon;

-- 2) Tighten job_applications public INSERT policy with server-side validation
DROP POLICY IF EXISTS "Anyone can submit application" ON public.job_applications;
CREATE POLICY "Anyone can submit application"
ON public.job_applications
FOR INSERT
WITH CHECK (
  name IS NOT NULL
  AND length(btrim(name)) BETWEEN 2 AND 120
  AND email IS NOT NULL
  AND length(email) BETWEEN 5 AND 255
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND phone IS NOT NULL
  AND length(phone) BETWEEN 8 AND 30
  AND position IS NOT NULL
  AND length(position) BETWEEN 2 AND 120
  AND (message IS NULL OR length(message) <= 2000)
  AND (resume_url IS NULL OR length(resume_url) <= 500)
);

-- 3) Bind review_media INSERT to the caller's own review
DROP POLICY IF EXISTS "Anyone can create review media" ON public.review_media;
CREATE POLICY "Users can attach media only to their own reviews"
ON public.review_media
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.product_reviews pr
    WHERE pr.id = review_media.review_id
      AND lower(pr.customer_email) = lower((auth.jwt() ->> 'email'))
  )
);