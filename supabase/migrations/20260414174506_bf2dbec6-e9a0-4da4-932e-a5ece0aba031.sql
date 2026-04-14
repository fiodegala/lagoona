-- Drop the old overly broad policy
DROP POLICY IF EXISTS "vm_stock can view stock service orders" ON public.service_orders;

-- Create precise policy: department managers see OS from their departments
CREATE POLICY "Department managers can view their department OS"
ON public.service_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM department_managers dm
    JOIN service_order_departments sod ON sod.id = dm.department_id
    WHERE dm.user_id = auth.uid()
      AND sod.name = service_orders.department
  )
);