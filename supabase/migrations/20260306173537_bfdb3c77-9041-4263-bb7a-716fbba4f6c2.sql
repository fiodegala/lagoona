
DROP POLICY "Users can view roles of same store" ON public.user_roles;

CREATE POLICY "Users can view roles of same store"
ON public.user_roles
FOR SELECT
USING (
  has_any_admin_role(auth.uid())
  AND store_id = public.user_store_id(auth.uid())
);
