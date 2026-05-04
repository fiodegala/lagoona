-- Ampliar permissão de upload em product-images para qualquer usuário autenticado com role
DROP POLICY IF EXISTS "Admin/Manager can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Manager can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Manager can delete product images" ON storage.objects;

CREATE POLICY "Authenticated staff can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND has_any_admin_role(auth.uid()));

CREATE POLICY "Authenticated staff can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND has_any_admin_role(auth.uid()));

CREATE POLICY "Admin/Manager can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND is_admin_or_manager(auth.uid()));