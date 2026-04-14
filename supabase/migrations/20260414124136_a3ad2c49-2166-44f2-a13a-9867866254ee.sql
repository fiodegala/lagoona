
-- Helper function to check if user has vm_stock role
CREATE OR REPLACE FUNCTION public.has_vm_stock_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'vm_stock'
  )
$$;

-- Allow vm_stock users to insert store_stock records
CREATE POLICY "vm_stock can insert store stock"
ON public.store_stock
FOR INSERT
TO authenticated
WITH CHECK (public.has_vm_stock_role(auth.uid()));

-- Allow vm_stock users to update store_stock records
CREATE POLICY "vm_stock can update store stock"
ON public.store_stock
FOR UPDATE
TO authenticated
USING (public.has_vm_stock_role(auth.uid()));
