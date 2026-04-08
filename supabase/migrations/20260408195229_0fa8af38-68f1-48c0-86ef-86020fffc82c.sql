
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Any authenticated user can view service orders" ON public.service_orders;

-- Admins/Managers can view ALL service orders (already covered by ALL policy, but explicit SELECT for clarity)
CREATE POLICY "Admins can view all service orders"
ON public.service_orders
FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

-- Non-admin users can only view service orders they created
CREATE POLICY "Users can view own service orders"
ON public.service_orders
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);
