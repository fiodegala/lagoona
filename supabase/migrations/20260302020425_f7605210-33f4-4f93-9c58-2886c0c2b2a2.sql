-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can update abandoned carts" ON public.abandoned_carts;

-- Admin/Manager policies already exist for ALL and SELECT, keep those.
-- No public INSERT or UPDATE - all handled via edge function with service role.