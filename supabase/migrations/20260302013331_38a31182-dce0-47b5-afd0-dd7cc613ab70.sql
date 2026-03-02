
-- Create abandoned_carts table
CREATE TABLE public.abandoned_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'abandoned',
  recovered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can view abandoned carts
CREATE POLICY "Admin/Manager can view abandoned carts"
  ON public.abandoned_carts FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

-- Admin/Manager can manage abandoned carts
CREATE POLICY "Admin/Manager can manage abandoned carts"
  ON public.abandoned_carts FOR ALL
  USING (is_admin_or_manager(auth.uid()));

-- Anyone can insert abandoned carts (from checkout page)
CREATE POLICY "Anyone can insert abandoned carts"
  ON public.abandoned_carts FOR INSERT
  WITH CHECK (true);

-- Anyone can update their own abandoned cart by session_id
CREATE POLICY "Anyone can update abandoned carts"
  ON public.abandoned_carts FOR UPDATE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_abandoned_carts_updated_at
  BEFORE UPDATE ON public.abandoned_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for lookups
CREATE INDEX idx_abandoned_carts_session_id ON public.abandoned_carts(session_id);
CREATE INDEX idx_abandoned_carts_status ON public.abandoned_carts(status);
CREATE INDEX idx_abandoned_carts_created_at ON public.abandoned_carts(created_at DESC);
