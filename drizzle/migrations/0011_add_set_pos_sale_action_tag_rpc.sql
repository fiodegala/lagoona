CREATE OR REPLACE FUNCTION public.set_pos_sale_action_tag(
  _sale_id uuid,
  _action_tag_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sale record;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT id, status, store_id, user_id, seller_id, action_tag_id
    INTO v_sale
    FROM public.pos_sales
   WHERE id = _sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_sale.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Só é possível alterar a etiqueta de vendas concluídas' USING ERRCODE = 'P0001';
  END IF;

  IF public.has_role(v_uid, 'admin')
     OR EXISTS (
       SELECT 1
         FROM public.user_menu_permissions
        WHERE user_id = v_uid
          AND 'sales-manage' = ANY(allowed_menus)
     ) THEN
    v_allowed := true;
  ELSIF public.has_role(v_uid, 'manager') THEN
    v_allowed := (
      (v_sale.store_id IS NOT NULL AND v_sale.store_id IN (SELECT public.user_store_ids(v_uid)))
      OR v_sale.user_id = v_uid
      OR v_sale.seller_id = v_uid
    );
  ELSIF public.has_any_admin_role(v_uid) THEN
    v_allowed := (
      v_sale.user_id = v_uid
      OR v_sale.seller_id = v_uid
    );
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissão para alterar a etiqueta desta venda' USING ERRCODE = '42501';
  END IF;

  IF _action_tag_id IS NOT NULL AND _action_tag_id IS DISTINCT FROM v_sale.action_tag_id THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.sale_action_tags
       WHERE id = _action_tag_id
         AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Etiqueta inválida ou inativa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.pos_sales
     SET action_tag_id = _action_tag_id
   WHERE id = _sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_pos_sale_action_tag(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_pos_sale_action_tag(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pos_sale_action_tag(uuid, uuid) TO service_role;