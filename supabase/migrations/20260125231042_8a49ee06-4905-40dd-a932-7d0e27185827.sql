-- Add barcode field to product_variations table
ALTER TABLE public.product_variations 
ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Create index for barcode lookups
CREATE INDEX IF NOT EXISTS idx_product_variations_barcode ON public.product_variations(barcode);