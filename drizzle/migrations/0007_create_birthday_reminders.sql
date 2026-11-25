CREATE TABLE public.birthday_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  days_before integer NOT NULL DEFAULT 0 CHECK (days_before >= 0 AND days_before <= 30),
  days_after integer NOT NULL DEFAULT 0 CHECK (days_after >= 0 AND days_after <= 30),
  message_template text NOT NULL DEFAULT E'Olá, {nome}! Feliz aniversário! 🎉💛\nAqui é da Fio de Gala! Passando para desejar um dia incrível, cheio de saúde, alegria e muitas conquistas.\nSerá um prazer receber você na {loja} para comemorar essa data especial!',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

GRANT SELECT, INSERT, UPDATE ON public.birthday_settings TO authenticated;
GRANT ALL ON public.birthday_settings TO service_role;

ALTER TABLE public.birthday_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read birthday settings"
  ON public.birthday_settings FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Admins insert birthday settings"
  ON public.birthday_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update birthday settings"
  ON public.birthday_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.birthday_viewers (
  user_id uuid PRIMARY KEY,
  all_stores boolean NOT NULL DEFAULT false,
  store_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.birthday_viewers TO authenticated;
GRANT ALL ON public.birthday_viewers TO service_role;

ALTER TABLE public.birthday_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own birthday viewer row"
  ON public.birthday_viewers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert birthday viewers"
  ON public.birthday_viewers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update birthday viewers"
  ON public.birthday_viewers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete birthday viewers"
  ON public.birthday_viewers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.birthday_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  birthday_year integer NOT NULL CHECK (birthday_year >= 2020 AND birthday_year <= 2100),
  store_id uuid NULL REFERENCES public.stores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent')),
  sent_at timestamptz NULL,
  sent_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, birthday_year)
);

CREATE INDEX idx_birthday_reminders_year_status ON public.birthday_reminders (birthday_year, status);

GRANT SELECT ON public.birthday_reminders TO authenticated;
GRANT ALL ON public.birthday_reminders TO service_role;

ALTER TABLE public.birthday_reminders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_birthday_store(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role) OR EXISTS (
    SELECT 1 FROM public.birthday_viewers v
    WHERE v.user_id = _user_id
      AND (v.all_stores OR (_store_id IS NOT NULL AND _store_id = ANY (v.store_ids)))
  )
$$;

CREATE POLICY "Assigned users read birthday reminders"
  ON public.birthday_reminders FOR SELECT TO authenticated
  USING (public.can_view_birthday_store(auth.uid(), store_id));

CREATE OR REPLACE FUNCTION public.birthday_date_in_year(_birthday date, _year integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT make_date(
    _year,
    EXTRACT(MONTH FROM _birthday)::int,
    CASE
      WHEN EXTRACT(MONTH FROM _birthday)::int = 2
        AND EXTRACT(DAY FROM _birthday)::int = 29
        AND NOT ((_year % 4 = 0 AND _year % 100 <> 0) OR _year % 400 = 0)
      THEN 28
      ELSE EXTRACT(DAY FROM _birthday)::int
    END
  )
$$;

CREATE OR REPLACE FUNCTION public.get_birthday_reminders(
  _year integer DEFAULT NULL,
  _only_popup_due boolean DEFAULT false
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_document text,
  birthday date,
  birthday_year integer,
  birthday_date date,
  turning_age integer,
  store_id uuid,
  store_name text,
  status text,
  sent_at timestamptz,
  sent_by uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_target_year integer := COALESCE(_year, EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int);
  v_enabled boolean := true;
  v_days_before integer := 0;
  v_days_after integer := 0;
  v_is_admin boolean := false;
  v_viewer_exists boolean := false;
  v_viewer_all_stores boolean := false;
  v_viewer_store_ids uuid[] := '{}'::uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);

  SELECT true, v.all_stores, COALESCE(v.store_ids, '{}'::uuid[])
  INTO v_viewer_exists, v_viewer_all_stores, v_viewer_store_ids
  FROM public.birthday_viewers v
  WHERE v.user_id = v_uid;

  IF _only_popup_due THEN
    IF NOT COALESCE(v_viewer_exists, false) THEN
      RETURN;
    END IF;
    IF NOT v_viewer_all_stores AND COALESCE(array_length(v_viewer_store_ids, 1), 0) = 0 THEN
      RETURN;
    END IF;
  ELSE
    IF NOT v_is_admin AND NOT COALESCE(v_viewer_exists, false) THEN
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(s.enabled, true), COALESCE(s.days_before, 0), COALESCE(s.days_after, 0)
  INTO v_enabled, v_days_before, v_days_after
  FROM public.birthday_settings s
  WHERE s.id = 1;

  IF _only_popup_due AND NOT COALESCE(v_enabled, true) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH latest_sale AS (
    SELECT DISTINCT ON (ps.customer_id)
      ps.customer_id,
      ps.store_id
    FROM public.pos_sales ps
    WHERE ps.customer_id IS NOT NULL
      AND ps.store_id IS NOT NULL
      AND ps.status <> 'cancelled'
    ORDER BY ps.customer_id, ps.created_at DESC
  ),
  base AS (
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.document AS customer_document,
      c.birthday,
      COALESCE(c.store_id, ls.store_id) AS eff_store_id
    FROM public.customers c
    LEFT JOIN latest_sale ls ON ls.customer_id = c.id
    WHERE c.is_active = true
      AND c.birthday IS NOT NULL
      AND lower(trim(c.name)) NOT LIKE 'consumidor final%'
  ),
  with_occ AS (
    SELECT
      b.*,
      occ.occ_year AS birthday_year,
      occ.occ_date AS birthday_date,
      (occ.occ_year - EXTRACT(YEAR FROM b.birthday)::int) AS turning_age
    FROM base b
    CROSS JOIN LATERAL (
      SELECT
        y.yr AS occ_year,
        public.birthday_date_in_year(b.birthday, y.yr) AS occ_date
      FROM (
        SELECT CASE
          WHEN _only_popup_due THEN unnest(ARRAY[EXTRACT(YEAR FROM v_today)::int - 1, EXTRACT(YEAR FROM v_today)::int, EXTRACT(YEAR FROM v_today)::int + 1])
          ELSE v_target_year
        END AS yr
      ) y
    ) occ
    WHERE (
      NOT _only_popup_due
      OR occ.occ_date BETWEEN (v_today - v_days_after) AND (v_today + v_days_before)
    )
  )
  SELECT
    w.customer_id,
    w.customer_name,
    w.customer_phone,
    w.customer_document,
    w.birthday,
    w.birthday_year,
    w.birthday_date,
    w.turning_age,
    w.eff_store_id AS store_id,
    st.name AS store_name,
    COALESCE(br.status, 'pending') AS status,
    br.sent_at,
    br.sent_by
  FROM with_occ w
  LEFT JOIN public.stores st ON st.id = w.eff_store_id
  LEFT JOIN public.birthday_reminders br
    ON br.customer_id = w.customer_id
   AND br.birthday_year = w.birthday_year
  WHERE (
    CASE
      WHEN _only_popup_due THEN
        (v_viewer_all_stores OR (w.eff_store_id IS NOT NULL AND w.eff_store_id = ANY (v_viewer_store_ids)))
        AND COALESCE(br.status, 'pending') = 'pending'
      ELSE
        (v_is_admin OR v_viewer_all_stores OR (w.eff_store_id IS NOT NULL AND w.eff_store_id = ANY (v_viewer_store_ids)))
    END
  )
  ORDER BY w.birthday_date ASC, w.customer_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_birthday_reminder_status(
  _customer_id uuid,
  _year integer,
  _status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_id uuid;
  v_exists boolean;
BEGIN
  IF _status NOT IN ('sent', 'pending') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  IF _year < 2020 OR _year > 2100 THEN
    RAISE EXCEPTION 'Ano inválido';
  END IF;

  SELECT
    true,
    COALESCE(
      c.store_id,
      (
        SELECT ps.store_id
        FROM public.pos_sales ps
        WHERE ps.customer_id = c.id
          AND ps.store_id IS NOT NULL
          AND ps.status <> 'cancelled'
        ORDER BY ps.created_at DESC
        LIMIT 1
      )
    )
  INTO v_exists, v_store_id
  FROM public.customers c
  WHERE c.id = _customer_id;

  IF NOT COALESCE(v_exists, false) THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF NOT public.can_view_birthday_store(auth.uid(), v_store_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.birthday_reminders (
    customer_id,
    birthday_year,
    store_id,
    status,
    sent_at,
    sent_by,
    updated_at
  )
  VALUES (
    _customer_id,
    _year,
    v_store_id,
    _status,
    CASE WHEN _status = 'sent' THEN now() ELSE NULL END,
    CASE WHEN _status = 'sent' THEN auth.uid() ELSE NULL END,
    now()
  )
  ON CONFLICT (customer_id, birthday_year)
  DO UPDATE SET
    store_id = EXCLUDED.store_id,
    status = EXCLUDED.status,
    sent_at = EXCLUDED.sent_at,
    sent_by = EXCLUDED.sent_by,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_birthday_store(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birthday_date_in_year(date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_birthday_reminders(integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_birthday_reminder_status(uuid, integer, text) TO authenticated;