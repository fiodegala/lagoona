-- Allow all users with any admin role to see ALL product variations (including inactive)
-- This ensures stock page shows consistent variation-level data regardless of user role
CREATE POLICY "Users with role can view all variations"
ON public.product_variations
FOR SELECT
TO authenticated
USING (has_any_admin_role(auth.uid()));