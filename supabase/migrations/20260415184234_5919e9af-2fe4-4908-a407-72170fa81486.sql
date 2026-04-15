CREATE POLICY "Department managers can update their department OS"
ON public.service_orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.department_managers dm
    JOIN public.service_order_departments sod ON sod.id = dm.department_id
    WHERE dm.user_id = auth.uid()
      AND sod.name = service_orders.department
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.department_managers dm
    JOIN public.service_order_departments sod ON sod.id = dm.department_id
    WHERE dm.user_id = auth.uid()
      AND sod.name = service_orders.department
  )
);