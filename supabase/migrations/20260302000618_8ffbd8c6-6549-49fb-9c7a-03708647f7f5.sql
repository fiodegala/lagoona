
-- Create table for video testimonials
CREATE TABLE public.video_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_testimonials ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can manage
CREATE POLICY "Admin/Manager can manage video testimonials"
ON public.video_testimonials
FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Anyone can view active testimonials
CREATE POLICY "Anyone can view active video testimonials"
ON public.video_testimonials
FOR SELECT
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_video_testimonials_updated_at
BEFORE UPDATE ON public.video_testimonials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
