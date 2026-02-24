
-- Add store_id column to sales_goals for per-store goals
ALTER TABLE public.sales_goals ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Create index for efficient lookups
CREATE INDEX idx_sales_goals_store_id ON public.sales_goals(store_id);

-- Add unique constraint to prevent duplicate goal types per store
ALTER TABLE public.sales_goals ADD CONSTRAINT unique_goal_type_store UNIQUE (type, store_id);
