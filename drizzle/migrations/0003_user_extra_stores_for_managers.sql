CREATE TABLE public.user_extra_stores (
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, store_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_extra_stores TO authenticated;
GRANT ALL ON public.user_extra_stores TO service_role;

ALTER TABLE public.user_extra_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage extra stores"
ON public.user_extra_stores FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users read own extra stores"
ON public.user_extra_stores FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Loja principal + lojas extras que o usuário gerencia
CREATE OR REPLACE FUNCTION public.user_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT store_id FROM public.user_roles WHERE user_id = _user_id AND store_id IS NOT NULL
  UNION
  SELECT store_id FROM public.user_extra_stores WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.user_accessible_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.user_store_ids(_user_id) AS id
  UNION
  SELECT s2.id
  FROM public.stores s2
  WHERE s2.type = 'website'
  AND EXISTS (
    SELECT 1 FROM public.stores s3
    WHERE s3.id IN (SELECT public.user_store_ids(_user_id)) AND s3.type = 'online'
  )
$$;

DROP POLICY IF EXISTS "Users can view sales from their store" ON public.pos_sales;
CREATE POLICY "Users can view sales from their store"
ON public.pos_sales FOR SELECT TO authenticated
USING (store_id IS NOT NULL AND store_id IN (SELECT public.user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can view sessions from their store" ON public.pos_sessions;
CREATE POLICY "Users can view sessions from their store"
ON public.pos_sessions FOR SELECT TO authenticated
USING (store_id IS NOT NULL AND store_id IN (SELECT public.user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can view roles of same store" ON public.user_roles;
CREATE POLICY "Users can view roles of same store"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_any_admin_role(auth.uid()) AND store_id IN (SELECT public.user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Users with role can view profiles of same store" ON public.profiles;
CREATE POLICY "Users with role can view profiles of same store"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.has_any_admin_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = profiles.user_id
      AND ur2.store_id IN (SELECT public.user_store_ids(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Store users can update transfers from their store" ON public.stock_transfers;
CREATE POLICY "Store users can update transfers from their store"
ON public.stock_transfers FOR UPDATE TO authenticated
USING (public.has_any_admin_role(auth.uid()) AND from_store_id IN (SELECT public.user_store_ids(auth.uid())))
WITH CHECK (public.has_any_admin_role(auth.uid()) AND from_store_id IN (SELECT public.user_store_ids(auth.uid())));