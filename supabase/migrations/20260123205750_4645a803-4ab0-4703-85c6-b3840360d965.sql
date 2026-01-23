-- Add weight and dimensions columns to products table
ALTER TABLE public.products 
ADD COLUMN weight_kg numeric DEFAULT NULL,
ADD COLUMN width_cm numeric DEFAULT NULL,
ADD COLUMN height_cm numeric DEFAULT NULL,
ADD COLUMN depth_cm numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.products.weight_kg IS 'Product weight in kilograms for shipping calculation';
COMMENT ON COLUMN public.products.width_cm IS 'Product width in centimeters for shipping calculation';
COMMENT ON COLUMN public.products.height_cm IS 'Product height in centimeters for shipping calculation';
COMMENT ON COLUMN public.products.depth_cm IS 'Product depth in centimeters for shipping calculation';