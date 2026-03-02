
-- 1. Remove unnecessary INSERT policy on whatsapp_logs (edge function uses service role, bypasses RLS)
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp logs" ON public.whatsapp_logs;

-- 2. Restrict review-media uploads to authenticated users only
DROP POLICY IF EXISTS "Anyone can upload review media" ON storage.objects;

CREATE POLICY "Authenticated users can upload review media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'review-media' 
  AND auth.uid() IS NOT NULL
);
