ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'varejo';

-- Backfill: set sale_type to 'troca' for existing exchange sales
UPDATE public.pos_sales SET sale_type = 'troca' WHERE notes LIKE 'TROCA -%' AND sale_type = 'varejo';