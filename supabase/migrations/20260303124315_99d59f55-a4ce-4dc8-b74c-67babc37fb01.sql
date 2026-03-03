
-- Create stock transfers table
CREATE TABLE public.stock_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_store_id uuid NOT NULL REFERENCES public.stores(id),
  to_store_id uuid NOT NULL REFERENCES public.stores(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  variation_id uuid REFERENCES public.product_variations(id),
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  requested_by uuid NOT NULL,
  approved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quantity_positive CHECK (quantity > 0),
  CONSTRAINT different_stores CHECK (from_store_id != to_store_id)
);

-- Enable RLS
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Any role user can view transfers"
ON public.stock_transfers FOR SELECT
USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Any role user can create transfers"
ON public.stock_transfers FOR INSERT
WITH CHECK (has_any_admin_role(auth.uid()));

CREATE POLICY "Admin/Manager can manage transfers"
ON public.stock_transfers FOR ALL
USING (is_admin_or_manager(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_stock_transfers_updated_at
BEFORE UPDATE ON public.stock_transfers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
