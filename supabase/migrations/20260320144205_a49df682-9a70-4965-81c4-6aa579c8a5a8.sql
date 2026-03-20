CREATE POLICY "Store users can update transfers from their store"
ON public.stock_transfers
FOR UPDATE
TO authenticated
USING (
  has_any_admin_role(auth.uid()) 
  AND from_store_id = user_store_id(auth.uid())
)
WITH CHECK (
  has_any_admin_role(auth.uid()) 
  AND from_store_id = user_store_id(auth.uid())
);