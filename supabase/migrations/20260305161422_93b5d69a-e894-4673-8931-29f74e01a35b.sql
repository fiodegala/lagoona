
CREATE TABLE public.product_upsells (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  upsell_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (product_id, upsell_product_id)
);

ALTER TABLE public.product_upsells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can manage upsells" ON public.product_upsells
  FOR ALL USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view active upsells" ON public.product_upsells
  FOR SELECT USING (is_active = true);
