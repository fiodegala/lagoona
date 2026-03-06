-- Allow all users with any admin role to see ALL products (including inactive)
-- This ensures stock page shows consistent data regardless of user role
CREATE POLICY "Users with role can view all products"
ON public.products
FOR SELECT
TO authenticated
USING (has_any_admin_role(auth.uid()));