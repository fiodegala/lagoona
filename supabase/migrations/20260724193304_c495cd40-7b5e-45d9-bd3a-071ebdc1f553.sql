DROP POLICY IF EXISTS "Authenticated users can upload review media" ON storage.objects;

CREATE POLICY "Authenticated users can upload review media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-media'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.product_reviews pr
    WHERE pr.id::text = split_part(storage.objects.name, '/', 1)
      AND lower(pr.customer_email) = lower(auth.jwt() ->> 'email')
  )
);