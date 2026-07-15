-- 1. audit_logs: restrict INSERT to staff roles and enforce user_id = auth.uid()
DROP POLICY IF EXISTS "Any authenticated user can insert audit logs" ON public.audit_logs;

CREATE POLICY "Staff can insert their own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.has_any_admin_role(auth.uid())
  AND action IS NOT NULL
  AND entity_type IS NOT NULL
);

-- 2. resumes bucket: replace open INSERT policy with size/type-constrained one
DROP POLICY IF EXISTS "Anyone can upload resumes" ON storage.objects;

CREATE POLICY "Public can upload constrained resumes"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'resumes'
  AND COALESCE((metadata->>'size')::bigint, 0) <= 5242880
  AND (
    lower(name) LIKE '%.pdf'
    OR lower(name) LIKE '%.doc'
    OR lower(name) LIKE '%.docx'
  )
);

-- 3. store_stock: remove raw public exposure; expose aggregated view instead
DROP POLICY IF EXISTS "Public can view stock quantities" ON public.store_stock;

DROP VIEW IF EXISTS public.public_product_stock;

CREATE VIEW public.public_product_stock
WITH (security_invoker = false) AS
SELECT
  product_id,
  variation_id,
  SUM(quantity)::integer AS quantity
FROM public.store_stock
GROUP BY product_id, variation_id;

GRANT SELECT ON public.public_product_stock TO anon, authenticated;