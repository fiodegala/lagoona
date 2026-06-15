
CREATE TABLE public.score_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  score_brasil INTEGER NOT NULL,
  score_haiti INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.score_predictions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.score_predictions TO authenticated;
GRANT ALL ON public.score_predictions TO service_role;

ALTER TABLE public.score_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a prediction"
  ON public.score_predictions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins and managers can view predictions"
  ON public.score_predictions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can delete predictions"
  ON public.score_predictions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
