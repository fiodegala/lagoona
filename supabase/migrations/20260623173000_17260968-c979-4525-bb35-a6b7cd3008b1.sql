
-- products: revoke sensitive columns from anon and public
REVOKE SELECT (wholesale_price, exclusive_price, cost_price)
  ON public.products FROM anon;
REVOKE SELECT (wholesale_price, exclusive_price, cost_price)
  ON public.products FROM PUBLIC;

-- product_variations: revoke sensitive columns from anon and public
REVOKE SELECT (wholesale_price, exclusive_price)
  ON public.product_variations FROM anon;
REVOKE SELECT (wholesale_price, exclusive_price)
  ON public.product_variations FROM PUBLIC;

-- Re-grant the safe columns to anon so the storefront keeps working.
GRANT SELECT (
  id, name, description, price, promotional_price, image_url, metadata,
  category_id, is_active, barcode, external_id,
  weight_kg, width_cm, height_cm, depth_cm, min_stock,
  visible_in_pos, visible_in_catalog, is_lagoona, stock,
  created_at, updated_at
) ON public.products TO anon;

GRANT SELECT (
  id, product_id, sku, barcode, price, promotional_price, stock, image_url,
  is_active, visible_site, visible_pdv, visible_catalog, sort_order,
  created_at, updated_at
) ON public.product_variations TO anon;

GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.product_variations TO service_role;

COMMENT ON COLUMN public.products.wholesale_price IS
  'Sensitive: column-level SELECT revoked from anon/public. Only authenticated admin/manager (and service_role) may read.';
COMMENT ON COLUMN public.products.exclusive_price IS
  'Sensitive: column-level SELECT revoked from anon/public. Only authenticated admin/manager (and service_role) may read.';
COMMENT ON COLUMN public.products.cost_price IS
  'Sensitive: column-level SELECT revoked from anon/public. Only authenticated admin/manager (and service_role) may read.';
COMMENT ON COLUMN public.product_variations.wholesale_price IS
  'Sensitive: column-level SELECT revoked from anon/public. Only authenticated admin/manager (and service_role) may read.';
COMMENT ON COLUMN public.product_variations.exclusive_price IS
  'Sensitive: column-level SELECT revoked from anon/public. Only authenticated admin/manager (and service_role) may read.';
