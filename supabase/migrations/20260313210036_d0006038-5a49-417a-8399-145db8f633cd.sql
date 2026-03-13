
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS dedup_hash text;

UPDATE pos_sales
SET dedup_hash = md5(
  COALESCE(customer_name, '') || '|' ||
  created_at::date::text || '|' ||
  total::text || '|' ||
  payment_method || '|' ||
  COALESCE((payment_details->>'seller')::text, '') || '|' ||
  COALESCE((payment_details->>'product_ref')::text, '')
)
WHERE notes LIKE '%Importado da planilha%' AND dedup_hash IS NULL;

CREATE UNIQUE INDEX idx_pos_sales_dedup_hash ON pos_sales (dedup_hash) WHERE dedup_hash IS NOT NULL;
