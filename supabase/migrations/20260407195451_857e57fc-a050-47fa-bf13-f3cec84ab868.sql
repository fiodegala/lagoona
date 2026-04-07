CREATE POLICY "Sellers/Support can update orders"
ON public.orders FOR UPDATE TO authenticated
USING (has_any_admin_role(auth.uid()))
WITH CHECK (has_any_admin_role(auth.uid()));