
-- Add personal data and address fields to profiles
ALTER TABLE public.profiles
ADD COLUMN phone text,
ADD COLUMN birthday date,
ADD COLUMN document text,
ADD COLUMN address text,
ADD COLUMN address_number text,
ADD COLUMN complement text,
ADD COLUMN neighborhood text,
ADD COLUMN city text,
ADD COLUMN state text,
ADD COLUMN zip_code text;
