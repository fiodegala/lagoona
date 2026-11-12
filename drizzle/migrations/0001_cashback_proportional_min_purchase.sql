ALTER TABLE public.cashback_settings
  ADD COLUMN IF NOT EXISTS min_use_mode text NOT NULL DEFAULT 'proportional' CHECK (min_use_mode IN ('proportional','fixed')),
  ADD COLUMN IF NOT EXISTS max_cover_percent numeric NOT NULL DEFAULT 15 CHECK (max_cover_percent > 0 AND max_cover_percent <= 100);
ALTER TABLE public.cashback_settings ALTER COLUMN sale_types SET DEFAULT ARRAY['varejo'];

ALTER TABLE public.cashback_reminders ADD COLUMN IF NOT EXISTS max_cover_percent numeric;

CREATE OR REPLACE FUNCTION public.cashback_min_next_purchase(_cashback numeric, _cover_percent numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ceil(round(_cashback * 100 / _cover_percent, 6))
$$;

CREATE OR REPLACE FUNCTION public.upsert_cashback_reminder(_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s record; cfg record; c record; st_name text; v_items jsonb; v_cash numeric; v_min numeric; v_cover numeric;
BEGIN
  SELECT * INTO s FROM public.pos_sales WHERE id = _sale_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF s.status = 'cancelled' THEN
    UPDATE public.cashback_reminders SET status = 'cancelled', updated_at = now()
      WHERE sale_id = _sale_id AND status = 'pending';
    RETURN;
  END IF;

  SELECT * INTO cfg FROM public.cashback_settings WHERE id = 1;
  IF NOT FOUND OR NOT cfg.enabled THEN RETURN; END IF;
  IF s.status <> 'completed' OR s.customer_id IS NULL THEN RETURN; END IF;
  IF NOT (coalesce(s.sale_type, 'varejo') = ANY (cfg.sale_types)) THEN RETURN; END IF;
  IF coalesce(s.total, 0) <= 0 OR s.total < cfg.min_sale_value THEN RETURN; END IF;

  SELECT * INTO c FROM public.customers WHERE id = s.customer_id;
  IF NOT FOUND OR lower(trim(coalesce(c.name, ''))) LIKE 'consumidor final%' THEN RETURN; END IF;

  SELECT name INTO st_name FROM public.stores WHERE id = s.store_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', i->>'name',
      'quantity', coalesce((i->>'quantity')::numeric, 1),
      'unit_price', coalesce((i->>'unit_price')::numeric, 0),
      'total', coalesce((i->>'total')::numeric, 0)
    )), '[]'::jsonb)
    INTO v_items
    FROM jsonb_array_elements(coalesce(s.items, '[]'::jsonb)) i
    WHERE coalesce((i->>'is_gift')::boolean, false) = false;

  v_cash := round(s.total * cfg.percent / 100.0, 2);
  IF cfg.min_use_mode = 'proportional' THEN
    v_cover := cfg.max_cover_percent;
    v_min := public.cashback_min_next_purchase(v_cash, v_cover);
  ELSE
    v_cover := NULL;
    v_min := cfg.min_use_value;
  END IF;

  INSERT INTO public.cashback_reminders AS r (
    sale_id, customer_id, customer_name, customer_phone, customer_document, store_id, store_name, seller_id,
    sale_date, sale_total, items, cashback_percent, cashback_value, min_use_value, max_cover_percent, expires_at
  ) VALUES (
    s.id, s.customer_id, coalesce(c.name, s.customer_name), coalesce(c.phone, c.responsavel_telefone),
    coalesce(c.document, s.customer_document), s.store_id, st_name, coalesce(s.seller_id, s.user_id),
    s.created_at, s.total, v_items, cfg.percent, v_cash, v_min, v_cover,
    ((s.created_at AT TIME ZONE 'America/Sao_Paulo')::date + cfg.validity_days)
  )
  ON CONFLICT (sale_id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id, customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone, customer_document = EXCLUDED.customer_document,
    store_id = EXCLUDED.store_id, store_name = EXCLUDED.store_name, seller_id = EXCLUDED.seller_id,
    sale_total = EXCLUDED.sale_total, items = EXCLUDED.items,
    cashback_value = round(EXCLUDED.sale_total * r.cashback_percent / 100.0, 2),
    min_use_value = CASE WHEN r.max_cover_percent IS NOT NULL
      THEN public.cashback_min_next_purchase(round(EXCLUDED.sale_total * r.cashback_percent / 100.0, 2), r.max_cover_percent)
      ELSE r.min_use_value END,
    status = CASE WHEN r.status = 'cancelled' THEN 'pending' ELSE r.status END,
    updated_at = now()
  WHERE r.status <> 'sent';
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_cashback_reminder(uuid) FROM PUBLIC, anon, authenticated;