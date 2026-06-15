CREATE POLICY "vm_stock can view store stock"
ON public.store_stock
FOR SELECT
USING (public.has_vm_stock_role(auth.uid()));