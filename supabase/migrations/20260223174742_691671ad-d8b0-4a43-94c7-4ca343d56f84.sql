
-- Add promotional price column to products
ALTER TABLE public.products ADD COLUMN promotional_price numeric DEFAULT NULL;

-- Add promotional price column to product_variations
ALTER TABLE public.product_variations ADD COLUMN promotional_price numeric DEFAULT NULL;
