
CREATE OR REPLACE FUNCTION public.process_stock_transfer(
  _transfer_id uuid,
  _action text, -- 'approve' or 'reject'
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _transfer record;
  _source record;
  _dest record;
  _dest_store_type text;
BEGIN
  -- Validate action
  IF _action NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ação inválida. Use approve ou reject.');
  END IF;

  -- Get transfer
  SELECT * INTO _transfer FROM stock_transfers WHERE id = _transfer_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transferência não encontrada ou já processada.');
  END IF;

  -- Reject is simple
  IF _action = 'reject' THEN
    UPDATE stock_transfers SET status = 'rejected', approved_by = _user_id WHERE id = _transfer_id;
    RETURN jsonb_build_object('success', true, 'action', 'rejected');
  END IF;

  -- === APPROVE: Move stock ===

  -- Get source stock record
  SELECT id, quantity INTO _source
  FROM store_stock
  WHERE store_id = _transfer.from_store_id
    AND product_id = _transfer.product_id
    AND (
      (_transfer.variation_id IS NOT NULL AND variation_id = _transfer.variation_id)
      OR (_transfer.variation_id IS NULL AND variation_id IS NULL)
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro de estoque não encontrado na origem.');
  END IF;

  IF _source.quantity < _transfer.quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Estoque insuficiente na origem. Disponível: %s, solicitado: %s', _source.quantity, _transfer.quantity));
  END IF;

  -- Deduct from source
  UPDATE store_stock
  SET quantity = quantity - _transfer.quantity, updated_at = now()
  WHERE id = _source.id;

  -- Check destination store type
  SELECT type INTO _dest_store_type FROM stores WHERE id = _transfer.to_store_id;

  -- Only add to destination if it's NOT online/website (aggregated stock)
  IF _dest_store_type NOT IN ('online', 'website') THEN
    SELECT id, quantity INTO _dest
    FROM store_stock
    WHERE store_id = _transfer.to_store_id
      AND product_id = _transfer.product_id
      AND (
        (_transfer.variation_id IS NOT NULL AND variation_id = _transfer.variation_id)
        OR (_transfer.variation_id IS NULL AND variation_id IS NULL)
      );

    IF FOUND THEN
      UPDATE store_stock
      SET quantity = quantity + _transfer.quantity, updated_at = now()
      WHERE id = _dest.id;
    ELSE
      INSERT INTO store_stock (store_id, product_id, variation_id, quantity)
      VALUES (_transfer.to_store_id, _transfer.product_id, _transfer.variation_id, _transfer.quantity);
    END IF;
  END IF;

  -- Mark transfer as completed
  UPDATE stock_transfers SET status = 'completed', approved_by = _user_id WHERE id = _transfer_id;

  RETURN jsonb_build_object('success', true, 'action', 'approved', 'quantity_moved', _transfer.quantity);
END;
$$;
