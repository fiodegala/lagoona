GRANT SELECT ON public.store_stock TO anon;
CREATE POLICY "Public can view stock quantities" ON public.store_stock FOR SELECT TO anon, authenticated USING (true);