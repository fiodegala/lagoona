-- Drop the existing ALL policy and recreate with proper WITH CHECK
DROP POLICY IF EXISTS "Admin can manage config" ON public.store_config;

CREATE POLICY "Admin can manage config"
ON public.store_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));