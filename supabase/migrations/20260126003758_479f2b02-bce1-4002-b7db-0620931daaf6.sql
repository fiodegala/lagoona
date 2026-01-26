-- Add sort_order column to categories table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Update existing categories with sequential sort order based on name
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 as rn
  FROM public.categories
)
UPDATE public.categories c
SET sort_order = n.rn
FROM numbered n
WHERE c.id = n.id;