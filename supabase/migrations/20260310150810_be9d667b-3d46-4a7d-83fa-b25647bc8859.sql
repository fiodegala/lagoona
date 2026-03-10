
-- Allow users with any admin role to view all pos_sales from their store
CREATE POLICY "Users can view sales from their store"
ON public.pos_sales FOR SELECT
TO authenticated
USING (
  has_any_admin_role(auth.uid()) AND store_id = public.user_store_id(auth.uid())
);
