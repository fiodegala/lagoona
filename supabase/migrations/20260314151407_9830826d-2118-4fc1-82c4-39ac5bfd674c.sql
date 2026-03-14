
CREATE TABLE public.import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  import_type text NOT NULL,
  records_sent integer NOT NULL DEFAULT 0,
  records_inserted integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  errors text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can manage import history"
  ON public.import_history FOR ALL
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can insert their own import history"
  ON public.import_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own import history"
  ON public.import_history FOR SELECT
  USING (auth.uid() = user_id);
