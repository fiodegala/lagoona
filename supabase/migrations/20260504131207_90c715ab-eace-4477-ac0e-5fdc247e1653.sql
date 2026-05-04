
-- Config table (singleton)
CREATE TABLE public.crm_integration_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  base_url text,
  auth_header_name text NOT NULL DEFAULT 'Authorization',
  auth_header_prefix text NOT NULL DEFAULT 'Bearer ',
  webhook_secret text,
  sync_products boolean NOT NULL DEFAULT true,
  sync_variations boolean NOT NULL DEFAULT true,
  sync_stock boolean NOT NULL DEFAULT true,
  sync_prices boolean NOT NULL DEFAULT true,
  sync_orders boolean NOT NULL DEFAULT true,
  sync_customers boolean NOT NULL DEFAULT true,
  auto_sync_interval_minutes integer NOT NULL DEFAULT 30,
  last_full_sync_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_integration_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can manage crm_integration_config"
  ON public.crm_integration_config FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Sync logs
CREATE TABLE public.crm_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  direction text NOT NULL DEFAULT 'pull',
  status text NOT NULL DEFAULT 'pending',
  records_processed integer NOT NULL DEFAULT 0,
  records_inserted integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_sync_logs_entity_type ON public.crm_sync_logs(entity_type);
CREATE INDEX idx_crm_sync_logs_created_at ON public.crm_sync_logs(created_at DESC);

ALTER TABLE public.crm_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can manage crm_sync_logs"
  ON public.crm_sync_logs FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Entity mappings (local <-> external CRM)
CREATE TABLE public.crm_entity_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  local_id uuid,
  local_sku text,
  external_id text NOT NULL,
  external_sku text,
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'synced',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_crm_mappings_unique ON public.crm_entity_mappings(entity_type, external_id);
CREATE INDEX idx_crm_mappings_local ON public.crm_entity_mappings(entity_type, local_id);
CREATE INDEX idx_crm_mappings_local_sku ON public.crm_entity_mappings(entity_type, local_sku);

ALTER TABLE public.crm_entity_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can manage crm_entity_mappings"
  ON public.crm_entity_mappings FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Reuse existing trigger function for updated_at
CREATE TRIGGER trg_crm_config_updated_at BEFORE UPDATE ON public.crm_integration_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_crm_mappings_updated_at BEFORE UPDATE ON public.crm_entity_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed config singleton
INSERT INTO public.crm_integration_config DEFAULT VALUES;
