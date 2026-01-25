-- Add sort_order column to product_variations table
ALTER TABLE public.product_variations 
ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Update existing variations to have sequential sort_order based on created_at
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY created_at) - 1 as new_order
  FROM public.product_variations
)
UPDATE public.product_variations v
SET sort_order = n.new_order
FROM numbered n
WHERE v.id = n.id;