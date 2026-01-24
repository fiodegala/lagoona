-- Drop and recreate storage policies properly
DROP POLICY IF EXISTS "Admin/Manager can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Manager can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Manager can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;

-- Recreate with correct permissions
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Admin/Manager can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND is_admin_or_manager(auth.uid()));

CREATE POLICY "Admin/Manager can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND is_admin_or_manager(auth.uid()));

CREATE POLICY "Admin/Manager can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND is_admin_or_manager(auth.uid()));