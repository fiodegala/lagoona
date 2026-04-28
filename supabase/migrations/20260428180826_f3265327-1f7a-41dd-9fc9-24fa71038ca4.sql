CREATE OR REPLACE FUNCTION public.is_department_manager_for_department(_user_id uuid, _department text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.department_managers dm
    JOIN public.service_order_departments sod ON sod.id = dm.department_id
    WHERE dm.user_id = _user_id
      AND lower(trim(sod.name)) = lower(trim(_department))
  )
$$;

DROP POLICY IF EXISTS "Department managers can view their department OS" ON public.service_orders;
DROP POLICY IF EXISTS "Department managers can update their department OS" ON public.service_orders;

CREATE POLICY "Department managers can view their department OS"
ON public.service_orders
FOR SELECT
TO authenticated
USING (
  public.is_department_manager_for_department(auth.uid(), department)
  OR assigned_to = auth.uid()
);

CREATE POLICY "Department managers can update their department OS"
ON public.service_orders
FOR UPDATE
TO authenticated
USING (
  public.is_department_manager_for_department(auth.uid(), department)
  OR assigned_to = auth.uid()
)
WITH CHECK (
  public.is_department_manager_for_department(auth.uid(), department)
  OR assigned_to = auth.uid()
);

CREATE POLICY "Users can update own announcement dismissals"
ON public.announcement_dismissals
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);