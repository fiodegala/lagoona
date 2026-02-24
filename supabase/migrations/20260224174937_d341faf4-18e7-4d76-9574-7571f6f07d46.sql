
-- Allow any authenticated user with a role to insert customers (e.g., sellers from POS)
CREATE POLICY "Any role user can create customers"
ON public.customers
FOR INSERT
WITH CHECK (has_any_admin_role(auth.uid()));

-- Allow any role user to view customers (sellers need this for POS)
CREATE POLICY "Any role user can view customers"
ON public.customers
FOR SELECT
USING (has_any_admin_role(auth.uid()));
