-- Missing API grants (root cause: no privileges at all on public.orders)
GRANT INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

-- Recreate open INSERT policy for checkout (guests + logged users)
DROP POLICY IF EXISTS "Anyone can create orders via checkout" ON public.orders;
CREATE POLICY "Anyone can create orders via checkout"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
