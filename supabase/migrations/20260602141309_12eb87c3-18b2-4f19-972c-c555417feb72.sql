ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS image_url_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_mobile TEXT,
  ADD COLUMN IF NOT EXISTS overlay_enabled BOOLEAN NOT NULL DEFAULT true;