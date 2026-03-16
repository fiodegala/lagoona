
-- Add is_lagoona flag to products
ALTER TABLE public.products ADD COLUMN is_lagoona boolean NOT NULL DEFAULT false;

-- Insert Lagoona store
INSERT INTO public.stores (name, slug, type, is_active)
VALUES ('Lagoona', 'lagoona', 'physical', true)
ON CONFLICT DO NOTHING;
