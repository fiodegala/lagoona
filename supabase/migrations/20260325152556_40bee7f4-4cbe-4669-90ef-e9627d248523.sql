
-- Olist integration settings table
CREATE TABLE public.olist_integration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  api_token text,
  environment text NOT NULL DEFAULT 'production',
  sync_products boolean NOT NULL DEFAULT true,
  sync_orders boolean NOT NULL DEFAULT true,
  sync_invoices boolean NOT NULL DEFAULT true,
  auto_sync_interval_minutes integer NOT NULL DEFAULT 30,
  last_product_sync_at timestamptz,
  last_order_sync_at timestamptz,
  last_error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Olist sync logs
CREATE TABLE public.olist_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL, -- 'products', 'orders', 'invoices', 'stock'
  direction text NOT NULL DEFAULT 'pull', -- 'pull' or 'push'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'success', 'error'
  records_processed integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Olist product mappings (link local products to Olist products)
CREATE TABLE public.olist_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  olist_product_id text NOT NULL,
  olist_sku text,
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'synced',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(local_product_id),
  UNIQUE(olist_product_id)
);

-- Olist order mappings
CREATE TABLE public.olist_order_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  olist_order_code text NOT NULL UNIQUE,
  olist_status text,
  invoice_key text,
  invoice_number text,
  last_synced_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.olist_integration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olist_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olist_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olist_order_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies - admin only
CREATE POLICY "Admins can manage olist_integration" ON public.olist_integration
  FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can manage olist_sync_logs" ON public.olist_sync_logs
  FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can manage olist_product_mappings" ON public.olist_product_mappings
  FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can manage olist_order_mappings" ON public.olist_order_mappings
  FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_olist_integration_updated_at
  BEFORE UPDATE ON public.olist_integration
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_olist_product_mappings_updated_at
  BEFORE UPDATE ON public.olist_product_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_olist_order_mappings_updated_at
  BEFORE UPDATE ON public.olist_order_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
