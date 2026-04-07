-- Table to assign responsible users to departments (multiple per department)
CREATE TABLE public.department_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.service_order_departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(department_id, user_id)
);

ALTER TABLE public.department_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage department managers"
  ON public.department_managers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view department managers"
  ON public.department_managers FOR SELECT
  TO authenticated
  USING (has_any_admin_role(auth.uid()));

-- Add action tracking to service_orders
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS action_reason text,
  ADD COLUMN IF NOT EXISTS actioned_by uuid,
  ADD COLUMN IF NOT EXISTS actioned_at timestamptz;
