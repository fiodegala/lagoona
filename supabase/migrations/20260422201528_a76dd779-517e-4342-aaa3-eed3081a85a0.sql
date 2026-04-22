
-- Fix dashboard data discrepancy between admin and store sellers
-- Recreate the "Users can view sales from their store" policy so it works for ALL users 
-- who have a role tied to a store (not just admin/manager who already pass via the manage policy).
-- Also ensure the policy is independent from the store_id field accessor name.

DROP POLICY IF EXISTS "Users can view sales from their store" ON public.pos_sales;

CREATE POLICY "Users can view sales from their store"
ON public.pos_sales
FOR SELECT
TO authenticated
USING (
  store_id IS NOT NULL 
  AND store_id = public.user_store_id(auth.uid())
);

-- Same fix for pos_sessions and pos_transactions to keep dashboard / cash report consistent
DROP POLICY IF EXISTS "Users can view sessions from their store" ON public.pos_sessions;

CREATE POLICY "Users can view sessions from their store"
ON public.pos_sessions
FOR SELECT
TO authenticated
USING (
  store_id IS NOT NULL 
  AND store_id = public.user_store_id(auth.uid())
);
