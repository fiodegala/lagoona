-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  minimum_order_value NUMERIC DEFAULT 0,
  maximum_discount NUMERIC,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  max_uses_per_customer INTEGER DEFAULT 1,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applicable_categories UUID[] DEFAULT '{}',
  applicable_products UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coupon usage tracking table
CREATE TABLE public.coupon_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  discount_applied NUMERIC NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for coupons
CREATE POLICY "Anyone can view active coupons" 
  ON public.coupons 
  FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Admin/Manager can manage coupons" 
  ON public.coupons 
  FOR ALL 
  USING (is_admin_or_manager(auth.uid()));

-- RLS policies for coupon_usage
CREATE POLICY "Admin/Manager can view coupon usage" 
  ON public.coupon_usage 
  FOR SELECT 
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can create coupon usage" 
  ON public.coupon_usage 
  FOR INSERT 
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_active ON public.coupons(is_active) WHERE is_active = true;
CREATE INDEX idx_coupon_usage_coupon_id ON public.coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_customer ON public.coupon_usage(customer_email);

-- Add trigger for updated_at
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();