
-- Add customer type and birthday fields
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'pf';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday date;

-- Company fields (for PJ - pessoa jurídica)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS razao_social text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS nome_fantasia text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS inscricao_estadual text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS inscricao_municipal text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS responsavel_nome text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS responsavel_telefone text;
