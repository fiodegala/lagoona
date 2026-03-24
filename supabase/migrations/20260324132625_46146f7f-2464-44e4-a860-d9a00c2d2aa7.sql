
CREATE TABLE public.service_order_departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.service_order_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone with admin role can view departments"
  ON public.service_order_departments FOR SELECT
  TO authenticated
  USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Admin can manage departments"
  ON public.service_order_departments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed default departments
INSERT INTO public.service_order_departments (name) VALUES
  ('Compras'),
  ('TI / Tecnologia'),
  ('Marketing'),
  ('Financeiro / RH');

CREATE TRIGGER update_service_order_departments_updated_at
  BEFORE UPDATE ON public.service_order_departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
