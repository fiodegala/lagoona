CREATE POLICY "Anyone can create orders via checkout"
ON public.orders
FOR INSERT
WITH CHECK (true);