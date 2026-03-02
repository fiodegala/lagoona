
-- Function that returns all store_ids a user can access
-- Online store users can also access the Site store
CREATE OR REPLACE FUNCTION public.user_accessible_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT s.id 
  FROM public.stores s
  WHERE s.id = (SELECT store_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1)
  UNION
  SELECT s2.id
  FROM public.stores s2
  WHERE s2.type = 'website'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.stores s3 ON s3.id = ur.store_id
    WHERE ur.user_id = _user_id AND s3.type = 'online'
  )
$$;

-- Update is_online_store_user to also return true for website type
CREATE OR REPLACE FUNCTION public.is_online_store_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.stores s ON s.id = ur.store_id
    WHERE ur.user_id = _user_id AND s.type IN ('online', 'website')
  )
$$;
