CREATE OR REPLACE FUNCTION public.merge_imported_duplicate_sales()
RETURNS TABLE(merged_customer text, merged_date date, kept_id uuid, deleted_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  merged_items jsonb;
  merged_subtotal numeric;
  merged_total numeric;
  keep_id uuid;
  del_count int;
BEGIN
  FOR rec IN
    SELECT customer_name, DATE(created_at) as sale_date
    FROM pos_sales
    WHERE notes LIKE '%Importado da planilha%'
    GROUP BY customer_name, DATE(created_at)
    HAVING COUNT(*) > 1
  LOOP
    -- Get the first sale ID to keep
    SELECT id INTO keep_id
    FROM pos_sales
    WHERE customer_name = rec.customer_name
      AND DATE(created_at) = rec.sale_date
      AND notes LIKE '%Importado da planilha%'
    ORDER BY created_at
    LIMIT 1;

    -- Aggregate all items and totals
    SELECT 
      jsonb_agg(item),
      SUM(s.subtotal),
      SUM(s.total)
    INTO merged_items, merged_subtotal, merged_total
    FROM pos_sales s,
    LATERAL jsonb_array_elements(s.items) AS item
    WHERE s.customer_name = rec.customer_name
      AND DATE(s.created_at) = rec.sale_date
      AND s.notes LIKE '%Importado da planilha%';

    -- Update the kept sale
    UPDATE pos_sales
    SET items = merged_items,
        subtotal = merged_subtotal,
        total = merged_total
    WHERE id = keep_id;

    -- Delete duplicates
    DELETE FROM pos_sales
    WHERE customer_name = rec.customer_name
      AND DATE(created_at) = rec.sale_date
      AND notes LIKE '%Importado da planilha%'
      AND id != keep_id;

    GET DIAGNOSTICS del_count = ROW_COUNT;

    merged_customer := rec.customer_name;
    merged_date := rec.sale_date;
    kept_id := keep_id;
    deleted_count := del_count;
    RETURN NEXT;
  END LOOP;
END;
$$;