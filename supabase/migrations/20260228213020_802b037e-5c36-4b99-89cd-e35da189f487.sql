DROP POLICY IF EXISTS "Admin can manage config" ON public.store_config;

CREATE POLICY "Admin/Manager can manage config"
ON public.store_config
FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));