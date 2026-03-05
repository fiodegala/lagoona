ALTER TABLE public.pos_sales ADD COLUMN status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.pos_sales ADD COLUMN cancelled_at timestamp with time zone;
ALTER TABLE public.pos_sales ADD COLUMN cancelled_by uuid;
ALTER TABLE public.pos_sales ADD COLUMN cancel_reason text;