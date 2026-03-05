
CREATE TABLE public.user_menu_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed_menus text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage menu permissions"
  ON public.user_menu_permissions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own menu permissions"
  ON public.user_menu_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
