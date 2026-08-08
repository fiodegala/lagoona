CREATE OR REPLACE FUNCTION public.can_manage_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_manager(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_menu_permissions
        WHERE user_id = _user_id
          AND 'sales-manage' = ANY(allowed_menus)
      )
$$;

CREATE POLICY "Sales managers can update POS sales"
ON public.pos_sales FOR UPDATE TO authenticated
USING (public.can_manage_sales(auth.uid()))
WITH CHECK (public.can_manage_sales(auth.uid()));

CREATE POLICY "Sales managers can view POS sales"
ON public.pos_sales FOR SELECT TO authenticated
USING (public.can_manage_sales(auth.uid()));

CREATE POLICY "Sales managers can update store stock"
ON public.store_stock FOR UPDATE TO authenticated
USING (public.can_manage_sales(auth.uid()))
WITH CHECK (public.can_manage_sales(auth.uid()));

UPDATE public.user_menu_permissions
SET allowed_menus = array_append(allowed_menus, 'sales-manage')
WHERE user_id = 'aa1b582c-0758-419e-b1cd-dfbec25cbba1'
  AND NOT ('sales-manage' = ANY(allowed_menus));