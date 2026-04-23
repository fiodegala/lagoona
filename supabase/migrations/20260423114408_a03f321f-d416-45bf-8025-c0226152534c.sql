-- Fix: o índice btree em dedup_hash falha quando o valor é muito grande (>2704 bytes).
-- Trocamos por um índice único sobre o hash MD5 do conteúdo, que tem tamanho fixo (32 chars).

DROP INDEX IF EXISTS public.idx_pos_sales_dedup_hash;

CREATE UNIQUE INDEX idx_pos_sales_dedup_hash
  ON public.pos_sales (md5(dedup_hash))
  WHERE dedup_hash IS NOT NULL;