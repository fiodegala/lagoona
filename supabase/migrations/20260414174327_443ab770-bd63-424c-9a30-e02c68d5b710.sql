-- Allow vm_stock users to view service orders from their relevant departments or assigned to them
CREATE POLICY "vm_stock can view stock service orders"
ON public.service_orders
FOR SELECT
TO authenticated
USING (
  has_vm_stock_role(auth.uid()) AND (
    assigned_to = auth.uid()
    OR department IN (
      SELECT sod.name FROM service_order_departments sod
      JOIN department_managers dm ON dm.department_id = sod.id
      WHERE dm.user_id = auth.uid()
    )
    OR LOWER(department) = 'estoque'
  )
);

-- Also allow managers to view all service orders  
CREATE POLICY "Managers can view all service orders"
ON public.service_orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
);