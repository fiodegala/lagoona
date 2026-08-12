-- 1. Integration config
CREATE TABLE public.tiktok_integration (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id TEXT,
  shop_name TEXT,
  shop_cipher TEXT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  auto_sync_stock BOOLEAN NOT NULL DEFAULT true,
  auto_sync_price BOOLEAN NOT NULL DEFAULT false,
  auto_import_orders BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_order_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_integration TO authenticated;
GRANT ALL ON public.tiktok_integration TO service_role;
ALTER TABLE public.tiktok_integration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tiktok integration" ON public.tiktok_integration
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE TRIGGER update_tiktok_integration_updated_at
  BEFORE UPDATE ON public.tiktok_integration
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Product mappings
CREATE TABLE public.tiktok_product_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES public.product_variations(id) ON DELETE CASCADE,
  tiktok_product_id TEXT NOT NULL,
  tiktok_sku_id TEXT,
  seller_sku TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tiktok_product_mappings_sku_uidx
  ON public.tiktok_product_mappings (tiktok_product_id, COALESCE(tiktok_sku_id, ''));
CREATE INDEX tiktok_product_mappings_product_idx ON public.tiktok_product_mappings (product_id);
CREATE INDEX tiktok_product_mappings_seller_sku_idx ON public.tiktok_product_mappings (seller_sku);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_product_mappings TO authenticated;
GRANT ALL ON public.tiktok_product_mappings TO service_role;
ALTER TABLE public.tiktok_product_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tiktok product mappings" ON public.tiktok_product_mappings
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE TRIGGER update_tiktok_product_mappings_updated_at
  BEFORE UPDATE ON public.tiktok_product_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Order mappings
CREATE TABLE public.tiktok_order_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tiktok_order_id TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  tiktok_status TEXT,
  local_status TEXT,
  total NUMERIC,
  stock_deducted BOOLEAN NOT NULL DEFAULT false,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX tiktok_order_mappings_order_idx ON public.tiktok_order_mappings (order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_order_mappings TO authenticated;
GRANT ALL ON public.tiktok_order_mappings TO service_role;
ALTER TABLE public.tiktok_order_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tiktok order mappings" ON public.tiktok_order_mappings
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE TRIGGER update_tiktok_order_mappings_updated_at
  BEFORE UPDATE ON public.tiktok_order_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Sync logs
CREATE TABLE public.tiktok_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'success',
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX tiktok_sync_logs_created_idx ON public.tiktok_sync_logs (created_at DESC);

GRANT SELECT ON public.tiktok_sync_logs TO authenticated;
GRANT ALL ON public.tiktok_sync_logs TO service_role;
ALTER TABLE public.tiktok_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view tiktok sync logs" ON public.tiktok_sync_logs
  FOR SELECT TO authenticated
  USING (public.is_admin_or_manager(auth.uid()));