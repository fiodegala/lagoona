-- Drop the SECURITY DEFINER view flagged by the linter
DROP VIEW IF EXISTS public.public_product_stock;

-- Replace with a SECURITY DEFINER function returning aggregated stock per variation
CREATE OR REPLACE FUNCTION public.get_product_stock(_product_id uuid)
RETURNS TABLE(product_id uuid, variation_id uuid, quantity integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ss.product_id,
    ss.variation_id,
    SUM(ss.quantity)::integer AS quantity
  FROM public.store_stock ss
  WHERE ss.product_id = _product_id
  GROUP BY ss.product_id, ss.variation_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_stock(uuid) TO anon, authenticated;