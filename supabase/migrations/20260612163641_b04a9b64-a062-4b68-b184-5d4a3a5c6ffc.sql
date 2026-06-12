
-- 1) Fix privilege escalation: has_any_admin_role must check specific roles, not "any role"
CREATE OR REPLACE FUNCTION public.has_any_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'manager'::app_role, 'support'::app_role, 'seller'::app_role, 'cashier'::app_role)
  )
$function$;

-- 2) Remove fully-public store_stock SELECT policy. Keep authenticated/role-scoped policy.
DROP POLICY IF EXISTS "Anyone can view store stock quantities" ON public.store_stock;

-- 3) Require authentication to submit reviews and bind the email to the auth user
DROP POLICY IF EXISTS "Anyone can create reviews" ON public.product_reviews;

CREATE POLICY "Authenticated users can create reviews"
ON public.product_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND lower(customer_email) = lower((auth.jwt() ->> 'email'))
);
