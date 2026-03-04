
-- Create a public view that hides customer_email from product_reviews
CREATE OR REPLACE VIEW public.product_reviews_public
WITH (security_invoker = false)
AS
  SELECT 
    id,
    product_id,
    rating,
    is_verified_purchase,
    is_approved,
    helpful_count,
    created_at,
    updated_at,
    customer_name,
    title,
    comment
  FROM public.product_reviews
  WHERE is_approved = true;

-- Grant access to the view
GRANT SELECT ON public.product_reviews_public TO anon, authenticated;

-- Drop the old public SELECT policy that exposes emails
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.product_reviews;
