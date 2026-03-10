CREATE POLICY "Any user with role can view admin roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_any_admin_role(auth.uid()) AND role = 'admin'
);