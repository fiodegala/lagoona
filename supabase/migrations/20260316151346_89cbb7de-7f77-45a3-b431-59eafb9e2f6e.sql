ALTER TABLE public.banners ADD COLUMN media_type text NOT NULL DEFAULT 'image';
ALTER TABLE public.banners ADD COLUMN video_url text;