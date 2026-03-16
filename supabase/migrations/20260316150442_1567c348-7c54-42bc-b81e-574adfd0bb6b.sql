
CREATE TABLE public.customer_feedback_prints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  caption TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_feedback_prints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can manage feedback prints"
ON public.customer_feedback_prints
FOR ALL
TO public
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view active feedback prints"
ON public.customer_feedback_prints
FOR SELECT
TO public
USING (is_active = true);
