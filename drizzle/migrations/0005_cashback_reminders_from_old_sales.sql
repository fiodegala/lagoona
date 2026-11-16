ALTER TABLE public.cashback_reminders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','sale_manual')),
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE OR REPLACE FUNCTION public.create_cashback_reminders_from_sales(_sale_ids uuid[], _validity_from_today boolean DEFAULT true)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid; v_store uuid; v_created integer := 0; cfg record;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO cfg FROM public.cashback_settings WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Regras de cashback não configuradas'; END IF;
  IF NOT cfg.enabled THEN RAISE EXCEPTION 'O cashback está desligado nas Regras'; END IF;

  FOREACH sid IN ARRAY coalesce(_sale_ids, '{}') LOOP
    SELECT store_id INTO v_store FROM public.pos_sales WHERE id = sid;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF NOT public.can_view_cashback_store(auth.uid(), v_store) THEN RAISE EXCEPTION 'Sem permissão para esta loja'; END IF;
    IF EXISTS (SELECT 1 FROM public.cashback_reminders WHERE sale_id = sid) THEN CONTINUE; END IF;

    PERFORM public.upsert_cashback_reminder(sid);

    UPDATE public.cashback_reminders SET
      source = 'sale_manual',
      created_by = auth.uid(),
      expires_at = CASE WHEN _validity_from_today THEN v_today + cfg.validity_days ELSE expires_at END,
      updated_at = now()
    WHERE sale_id = sid;
    IF FOUND THEN v_created := v_created + 1; END IF;
  END LOOP;
  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.create_cashback_reminders_from_sales(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_cashback_reminders_from_sales(uuid[], boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_manual_cashback_reminder(_reminder_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  DELETE FROM public.cashback_reminders WHERE id = _reminder_id AND source = 'sale_manual';
END;
$$;
REVOKE ALL ON FUNCTION public.delete_manual_cashback_reminder(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_manual_cashback_reminder(uuid) TO authenticated;