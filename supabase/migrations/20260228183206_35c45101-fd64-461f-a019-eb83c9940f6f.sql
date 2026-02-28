CREATE POLICY "Anyone can view store stock quantities" 
ON public.store_stock 
FOR SELECT 
USING (true);