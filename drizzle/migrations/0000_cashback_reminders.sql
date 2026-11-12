-- Regras (linha única)
CREATE TABLE public.cashback_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  percent numeric NOT NULL DEFAULT 10,
  min_sale_value numeric NOT NULL DEFAULT 0,
  min_use_value numeric NOT NULL DEFAULT 150,
  validity_days integer NOT NULL DEFAULT 30,
  sale_types text[] NOT NULL DEFAULT ARRAY['varejo','atacado','exclusivo'],
  message_template text NOT NULL DEFAULT 'Olá, {nome}! Tudo bem? Aqui é da Fio de Gala 💛
Na sua compra de {data_compra} na loja {loja}, no valor de {valor_compra}, você ganhou {cashback} de cashback para usar em compras acima de {compra_minima}.
Seu cashback vale até {validade}. Esperamos você!',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.cashback_settings TO authenticated;
GRANT ALL ON public.cashback_settings TO service_role;
ALTER TABLE public.cashback_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read cashback settings" ON public.cashback_settings FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "Admins insert cashback settings" ON public.cashback_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update cashback settings" ON public.cashback_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.cashback_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Quem recebe os avisos e de quais lojas
CREATE TABLE public.cashback_viewers (
  user_id uuid PRIMARY KEY,
  all_stores boolean NOT NULL DEFAULT false,
  store_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_viewers TO authenticated;
GRANT ALL ON public.cashback_viewers TO service_role;
ALTER TABLE public.cashback_viewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own cashback viewer row" ON public.cashback_viewers FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert cashback viewers" ON public.cashback_viewers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update cashback viewers" ON public.cashback_viewers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete cashback viewers" ON public.cashback_viewers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Avisos gerados a partir das vendas
CREATE TABLE public.cashback_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL UNIQUE REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_document text,
  store_id uuid,
  store_name text,
  seller_id uuid,
  sale_date timestamptz NOT NULL,
  sale_total numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  cashback_percent numeric NOT NULL DEFAULT 0,
  cashback_value numeric NOT NULL DEFAULT 0,
  min_use_value numeric NOT NULL DEFAULT 0,
  expires_at date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled')),
  sent_at timestamptz,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cashback_reminders_status_date_idx ON public.cashback_reminders (status, sale_date);
CREATE INDEX cashback_reminders_store_idx ON public.cashback_reminders (store_id);
GRANT SELECT ON public.cashback_reminders TO authenticated;
GRANT ALL ON public.cashback_reminders TO service_role;
ALTER TABLE public.cashback_reminders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_cashback_store(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.cashback_viewers v
    WHERE v.user_id = _user_id AND (v.all_stores OR _store_id = ANY (v.store_ids))
  )
$$;

CREATE POLICY "Assigned users read cashback reminders" ON public.cashback_reminders FOR SELECT TO authenticated
  USING (public.can_view_cashback_store(auth.uid(), store_id));

-- Gera / atualiza o aviso de uma venda
CREATE OR REPLACE FUNCTION public.upsert_cashback_reminder(_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s record; cfg record; c record; st_name text; v_items jsonb; v_cash numeric;
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

  INSERT INTO public.cashback_reminders AS r (
    sale_id, customer_id, customer_name, customer_phone, customer_document, store_id, store_name, seller_id,
    sale_date, sale_total, items, cashback_percent, cashback_value, min_use_value, expires_at
  ) VALUES (
    s.id, s.customer_id, coalesce(c.name, s.customer_name), coalesce(c.phone, c.responsavel_telefone),
    coalesce(c.document, s.customer_document), s.store_id, st_name, coalesce(s.seller_id, s.user_id),
    s.created_at, s.total, v_items, cfg.percent, v_cash, cfg.min_use_value,
    ((s.created_at AT TIME ZONE 'America/Sao_Paulo')::date + cfg.validity_days)
  )
  ON CONFLICT (sale_id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id, customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone, customer_document = EXCLUDED.customer_document,
    store_id = EXCLUDED.store_id, store_name = EXCLUDED.store_name, seller_id = EXCLUDED.seller_id,
    sale_total = EXCLUDED.sale_total, items = EXCLUDED.items,
    cashback_value = round(EXCLUDED.sale_total * r.cashback_percent / 100.0, 2),
    status = CASE WHEN r.status = 'cancelled' THEN 'pending' ELSE r.status END,
    updated_at = now()
  WHERE r.status <> 'sent';
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_cashback_reminder(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_pos_sales_cashback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM public.upsert_cashback_reminder(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'cashback reminder failed for sale %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_sales_cashback_reminder
AFTER INSERT OR UPDATE OF status, customer_id, total, items, sale_type, store_id ON public.pos_sales
FOR EACH ROW EXECUTE FUNCTION public.trg_pos_sales_cashback();

-- Marcar como enviado / reabrir
CREATE OR REPLACE FUNCTION public.set_cashback_reminder_status(_reminder_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid;
BEGIN
  IF _status NOT IN ('sent', 'pending') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  SELECT store_id INTO v_store FROM public.cashback_reminders WHERE id = _reminder_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aviso não encontrado'; END IF;
  IF NOT public.can_view_cashback_store(auth.uid(), v_store) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.cashback_reminders SET
    status = _status,
    sent_at = CASE WHEN _status = 'sent' THEN now() ELSE NULL END,
    sent_by = CASE WHEN _status = 'sent' THEN auth.uid() ELSE NULL END,
    updated_at = now()
  WHERE id = _reminder_id AND status <> 'cancelled';
END;
$$;
REVOKE ALL ON FUNCTION public.set_cashback_reminder_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cashback_reminder_status(uuid, text) TO authenticated;

-- Backfill: vendas a partir de 12/11/2026 (horário de Brasília)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.pos_sales WHERE created_at >= '2026-11-12 00:00:00-03' LOOP
    PERFORM public.upsert_cashback_reminder(r.id);
  END LOOP;
END $$;