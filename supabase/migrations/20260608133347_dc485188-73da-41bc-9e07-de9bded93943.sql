ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS seller_id uuid;
CREATE INDEX IF NOT EXISTS idx_pos_sales_seller_id ON public.pos_sales(seller_id);

DROP POLICY IF EXISTS "Users can view their attributed sales" ON public.pos_sales;
CREATE POLICY "Users can view their attributed sales"
  ON public.pos_sales FOR SELECT
  USING (auth.uid() = seller_id);