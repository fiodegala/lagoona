CREATE POLICY "Online store sellers can view abandoned carts"
ON public.abandoned_carts
FOR SELECT
TO authenticated
USING (
  is_online_store_user(auth.uid()) AND has_any_admin_role(auth.uid())
);