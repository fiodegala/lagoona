
DROP POLICY IF EXISTS "Admins can view all service orders" ON public.service_orders;

CREATE POLICY "Only admins can view all service orders"
ON public.service_orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
