CREATE OR REPLACE FUNCTION public.deduct_sale_stock(_store_id uuid, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item jsonb;
  _pid uuid;
  _vid uuid;
  _qty integer;
  _remaining integer;
  _row record;
  _store_type text;
  _deduct integer;
  _results jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_admin_role(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT type INTO _store_type FROM public.stores WHERE id = _store_id;
  IF _store_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store not found');
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := NULLIF(_item->>'product_id','')::uuid;
    _vid := NULLIF(_item->>'variation_id','')::uuid;
    _qty := COALESCE((_item->>'quantity')::integer, 0);
    IF _pid IS NULL OR _qty <= 0 THEN CONTINUE; END IF;
    _remaining := _qty;

    IF _store_type IN ('online','website') THEN
      FOR _row IN
        SELECT ss.id, ss.quantity, ss.store_id
        FROM public.store_stock ss
        JOIN public.stores s ON s.id = ss.store_id
        WHERE ss.product_id = _pid
          AND ((_vid IS NOT NULL AND ss.variation_id = _vid) OR (_vid IS NULL AND ss.variation_id IS NULL))
          AND s.type NOT IN ('online','website')
          AND ss.quantity > 0
        ORDER BY ss.quantity DESC
      LOOP
        EXIT WHEN _remaining <= 0;
        _deduct := LEAST(_remaining, _row.quantity);
        UPDATE public.store_stock
          SET quantity = _row.quantity - _deduct, updated_at = now()
          WHERE id = _row.id;
        _remaining := _remaining - _deduct;
      END LOOP;
    ELSE
      SELECT id, quantity INTO _row
      FROM public.store_stock
      WHERE store_id = _store_id
        AND product_id = _pid
        AND ((_vid IS NOT NULL AND variation_id = _vid) OR (_vid IS NULL AND variation_id IS NULL))
      ORDER BY quantity DESC
      LIMIT 1;

      IF FOUND THEN
        _deduct := LEAST(_remaining, GREATEST(_row.quantity, 0));
        UPDATE public.store_stock
          SET quantity = GREATEST(0, _row.quantity - _remaining), updated_at = now()
          WHERE id = _row.id;
        _remaining := _remaining - _deduct;
      END IF;
    END IF;

    IF _remaining > 0 THEN
      _results := _results || jsonb_build_object('product_id', _pid, 'variation_id', _vid, 'not_deducted', _remaining);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'warnings', _results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_sale_stock(uuid, jsonb) TO authenticated;