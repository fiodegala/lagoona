CREATE POLICY "Any user with role can view admin profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_any_admin_role(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.user_id 
    AND user_roles.role = 'admin'
  )
);