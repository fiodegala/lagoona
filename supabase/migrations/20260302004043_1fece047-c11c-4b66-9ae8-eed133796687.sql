-- Update check constraint to allow 'website' type
ALTER TABLE public.stores DROP CONSTRAINT stores_type_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_type_check CHECK (type = ANY (ARRAY['physical'::text, 'online'::text, 'website'::text]));
