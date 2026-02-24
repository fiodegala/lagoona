
CREATE TABLE public.zapi_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'unknown',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.zapi_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs"
ON public.zapi_webhook_logs
FOR SELECT
USING (public.has_any_admin_role(auth.uid()));
