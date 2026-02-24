
-- Drop old unique index that only considers type (prevents per-store goals)
DROP INDEX IF EXISTS public.idx_sales_goals_type;
