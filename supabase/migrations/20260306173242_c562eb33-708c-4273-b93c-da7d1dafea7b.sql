
CREATE POLICY "Users can view roles of same store"
ON public.user_roles
FOR SELECT
USING (
  has_any_admin_role(auth.uid())
  AND store_id = (SELECT ur.store_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1)
);
