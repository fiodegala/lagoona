CREATE TABLE public.manual_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view manual videos"
ON public.manual_videos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert manual videos"
ON public.manual_videos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update manual videos"
ON public.manual_videos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete manual videos"
ON public.manual_videos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_manual_videos_updated_at
BEFORE UPDATE ON public.manual_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();