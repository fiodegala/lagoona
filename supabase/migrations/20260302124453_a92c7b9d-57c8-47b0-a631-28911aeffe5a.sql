
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admin/Manager can manage abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Admin/Manager can view abandoned carts" ON public.abandoned_carts;

-- Create proper PERMISSIVE policies restricted to admin/manager
CREATE POLICY "Admin/Manager can manage abandoned carts"
ON public.abandoned_carts
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));
