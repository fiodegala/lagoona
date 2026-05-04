-- Drop CRM tables (this project is the source of truth, not a consumer)
DROP TABLE IF EXISTS public.crm_entity_mappings CASCADE;
DROP TABLE IF EXISTS public.crm_sync_logs CASCADE;
DROP TABLE IF EXISTS public.crm_integration_config CASCADE;

-- Add external_id to products (if not exists)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS products_external_id_unique ON public.products(external_id) WHERE external_id IS NOT NULL;

-- Add external_id to customers (if not exists)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS customers_external_id_unique ON public.customers(external_id) WHERE external_id IS NOT NULL;

-- orders.external_id already exists per store-orders edge function, ensure it's there
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS external_id text;
CREATE INDEX IF NOT EXISTS orders_external_id_idx ON public.orders(external_id) WHERE external_id IS NOT NULL;