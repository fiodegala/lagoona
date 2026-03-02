
-- Create storage bucket for testimonial videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('testimonial-videos', 'testimonial-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view testimonial videos
CREATE POLICY "Anyone can view testimonial videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'testimonial-videos');

-- Admin/Manager can upload testimonial videos
CREATE POLICY "Admin/Manager can upload testimonial videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'testimonial-videos' AND is_admin_or_manager(auth.uid()));

-- Admin/Manager can delete testimonial videos
CREATE POLICY "Admin/Manager can delete testimonial videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'testimonial-videos' AND is_admin_or_manager(auth.uid()));
