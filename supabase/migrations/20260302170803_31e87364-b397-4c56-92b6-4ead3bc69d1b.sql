
-- Create fiscal_requests table to store fiscal emission requests
CREATE TABLE public.fiscal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid REFERENCES public.pos_sales(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  fiscal_type text NOT NULL CHECK (fiscal_type IN ('nfce', 'nfe')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error', 'cancelled')),
  customer_name text,
  customer_document text,
  customer_email text,
  customer_phone text,
  customer_address jsonb,
  fiscal_number text,
  fiscal_key text,
  fiscal_url text,
  fiscal_pdf_url text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  requested_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fiscal_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin/Manager can manage fiscal requests"
ON public.fiscal_requests
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can create fiscal requests"
ON public.fiscal_requests
FOR INSERT
WITH CHECK (has_any_admin_role(auth.uid()));

CREATE POLICY "Users can view their fiscal requests"
ON public.fiscal_requests
FOR SELECT
USING (has_any_admin_role(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_fiscal_requests_updated_at
BEFORE UPDATE ON public.fiscal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
