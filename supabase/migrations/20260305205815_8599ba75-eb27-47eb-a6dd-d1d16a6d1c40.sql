
CREATE TABLE public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  local_id uuid NOT NULL,
  user_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id),
  customer_id uuid REFERENCES public.customers(id),
  customer_name text,
  customer_document text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL,
  discount_type text,
  discount_value numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total numeric NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone,
  converted_sale_id uuid REFERENCES public.pos_sales(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can manage quotes" ON public.quotes FOR ALL USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create quotes" ON public.quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own quotes" ON public.quotes FOR SELECT USING (auth.uid() = user_id);
