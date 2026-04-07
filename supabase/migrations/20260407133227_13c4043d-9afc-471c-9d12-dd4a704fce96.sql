
-- Table vm_posts
CREATE TABLE public.vm_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text DEFAULT 'Geral',
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table vm_editors
CREATE TABLE public.vm_editors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Function is_vm_editor
CREATE OR REPLACE FUNCTION public.is_vm_editor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vm_editors WHERE user_id = _user_id
  ) OR public.has_role(_user_id, 'admin'::app_role)
$$;

-- Trigger updated_at
CREATE TRIGGER set_vm_posts_updated_at
  BEFORE UPDATE ON public.vm_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS vm_posts
ALTER TABLE public.vm_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active vm posts"
  ON public.vm_posts FOR SELECT TO authenticated
  USING (is_active = true AND has_any_admin_role(auth.uid()));

CREATE POLICY "VM editors can insert vm posts"
  ON public.vm_posts FOR INSERT TO authenticated
  WITH CHECK (is_vm_editor(auth.uid()));

CREATE POLICY "VM editors can update vm posts"
  ON public.vm_posts FOR UPDATE TO authenticated
  USING (is_vm_editor(auth.uid()))
  WITH CHECK (is_vm_editor(auth.uid()));

CREATE POLICY "VM editors can delete vm posts"
  ON public.vm_posts FOR DELETE TO authenticated
  USING (is_vm_editor(auth.uid()));

-- RLS vm_editors
ALTER TABLE public.vm_editors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage vm editors"
  ON public.vm_editors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view vm editors"
  ON public.vm_editors FOR SELECT TO authenticated
  USING (has_any_admin_role(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('vm-media', 'vm-media', true);

-- Storage policies
CREATE POLICY "Anyone can view vm media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'vm-media');

CREATE POLICY "VM editors can upload vm media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vm-media' AND is_vm_editor(auth.uid()));

CREATE POLICY "VM editors can delete vm media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vm-media' AND is_vm_editor(auth.uid()));
