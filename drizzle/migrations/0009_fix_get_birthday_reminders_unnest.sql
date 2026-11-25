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
  v_years integer[];
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

  SELECT true, COALESCE(v.all_stores, false), COALESCE(v.store_ids, '{}'::uuid[])
  INTO v_viewer_exists, v_viewer_all_stores, v_viewer_store_ids
  FROM public.birthday_viewers v
  WHERE v.user_id = v_uid;

  v_viewer_exists := COALESCE(v_viewer_exists, false);
  v_viewer_all_stores := COALESCE(v_viewer_all_stores, false);
  v_viewer_store_ids := COALESCE(v_viewer_store_ids, '{}'::uuid[]);

  IF _only_popup_due THEN
    IF NOT v_viewer_exists THEN
      RETURN;
    END IF;
    IF NOT v_viewer_all_stores AND COALESCE(array_length(v_viewer_store_ids, 1), 0) = 0 THEN
      RETURN;
    END IF;
  ELSE
    IF NOT v_is_admin AND NOT v_viewer_exists THEN
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(s.enabled, true), COALESCE(s.days_before, 0), COALESCE(s.days_after, 0)
  INTO v_enabled, v_days_before, v_days_after
  FROM public.birthday_settings s
  WHERE s.id = 1;

  v_enabled := COALESCE(v_enabled, true);
  v_days_before := COALESCE(v_days_before, 0);
  v_days_after := COALESCE(v_days_after, 0);

  IF _only_popup_due AND NOT v_enabled THEN
    RETURN;
  END IF;

  IF _only_popup_due THEN
    v_years := ARRAY[
      EXTRACT(YEAR FROM v_today)::int - 1,
      EXTRACT(YEAR FROM v_today)::int,
      EXTRACT(YEAR FROM v_today)::int + 1
    ];
  ELSE
    v_years := ARRAY[v_target_year];
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
      y.yr AS birthday_year,
      public.birthday_date_in_year(b.birthday, y.yr) AS birthday_date,
      (y.yr - EXTRACT(YEAR FROM b.birthday)::int) AS turning_age
    FROM base b
    CROSS JOIN unnest(v_years) AS y(yr)
    WHERE (
      NOT _only_popup_due
      OR public.birthday_date_in_year(b.birthday, y.yr) BETWEEN (v_today - v_days_after) AND (v_today + v_days_before)
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