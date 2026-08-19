CREATE POLICY "Staff can view staff profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_any_admin_role(auth.uid())
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.user_id)
);