
CREATE TABLE public.quote_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  action text NOT NULL DEFAULT 'edit',
  changes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can view quote history"
  ON public.quote_history FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Any authenticated user can insert quote history"
  ON public.quote_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_quote_history_quote_id ON public.quote_history(quote_id);
