CREATE OR REPLACE FUNCTION public.get_staff_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND public.has_any_admin_role(auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_names(uuid[]) TO authenticated;