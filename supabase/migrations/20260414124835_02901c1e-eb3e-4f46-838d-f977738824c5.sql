
-- Drop the old admin-only policy
DROP POLICY IF EXISTS "Admin can manage departments" ON public.service_order_departments;

-- Create new policy allowing admin and manager
CREATE POLICY "Admin/Manager can manage departments"
ON public.service_order_departments
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));
