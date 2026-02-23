
-- Shipping zones table for CEP-based shipping configuration
CREATE TABLE public.shipping_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  zip_start TEXT NOT NULL,
  zip_end TEXT NOT NULL,
  base_price NUMERIC NOT NULL DEFAULT 0,
  price_per_kg NUMERIC NOT NULL DEFAULT 0,
  free_shipping_min_value NUMERIC DEFAULT NULL,
  estimated_days_min INTEGER NOT NULL DEFAULT 3,
  estimated_days_max INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can manage
CREATE POLICY "Admin/Manager can manage shipping zones"
ON public.shipping_zones FOR ALL
USING (is_admin_or_manager(auth.uid()));

-- Anyone can view active zones (needed for storefront shipping calc)
CREATE POLICY "Anyone can view active shipping zones"
ON public.shipping_zones FOR SELECT
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_shipping_zones_updated_at
BEFORE UPDATE ON public.shipping_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
