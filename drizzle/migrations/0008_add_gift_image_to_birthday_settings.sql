ALTER TABLE public.birthday_settings
  ADD COLUMN IF NOT EXISTS gift_image_url text NULL;