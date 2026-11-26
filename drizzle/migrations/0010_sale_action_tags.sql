CREATE TABLE public.sale_action_tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sale_action_tags TO authenticated;
GRANT ALL ON public.sale_action_tags TO service_role;
ALTER TABLE public.sale_action_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read action tags" ON public.sale_action_tags FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "Managers create action tags" ON public.sale_action_tags FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Managers update action tags" ON public.sale_action_tags FOR UPDATE TO authenticated USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));
CREATE UNIQUE INDEX sale_action_tags_name_unique ON public.sale_action_tags (lower(btrim(name)));
ALTER TABLE public.pos_sales ADD COLUMN action_tag_id uuid REFERENCES public.sale_action_tags(id);
CREATE INDEX pos_sales_action_tag_idx ON public.pos_sales(action_tag_id) WHERE action_tag_id IS NOT NULL;