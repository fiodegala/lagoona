
CREATE POLICY "Users with role can view profiles of same store"
ON public.profiles
FOR SELECT
USING (
  has_any_admin_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur1
    JOIN public.user_roles ur2 ON ur1.store_id = ur2.store_id
    WHERE ur1.user_id = auth.uid()
    AND ur2.user_id = profiles.user_id
  )
);
