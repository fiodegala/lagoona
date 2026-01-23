-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- Allow authenticated users (admin/manager) to upload product images
CREATE POLICY "Admin/Manager can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' 
  AND is_admin_or_manager(auth.uid())
);

-- Allow authenticated users (admin/manager) to update product images
CREATE POLICY "Admin/Manager can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND is_admin_or_manager(auth.uid())
);

-- Allow authenticated users (admin/manager) to delete product images
CREATE POLICY "Admin/Manager can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND is_admin_or_manager(auth.uid())
);

-- Allow public read access to product images
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');