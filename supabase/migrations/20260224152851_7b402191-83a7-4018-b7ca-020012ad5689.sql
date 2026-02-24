
-- Create table to log WhatsApp messages sent per order
CREATE TABLE public.whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  customer_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'tracking',
  status TEXT NOT NULL DEFAULT 'sent',
  zapi_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can view logs
CREATE POLICY "Admin/Manager can view whatsapp logs"
ON public.whatsapp_logs
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

-- No direct insert from client - only via edge function with service role
-- But we need insert for the edge function
CREATE POLICY "Authenticated users can insert whatsapp logs"
ON public.whatsapp_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Index for fast lookup by order
CREATE INDEX idx_whatsapp_logs_order_id ON public.whatsapp_logs(order_id);
