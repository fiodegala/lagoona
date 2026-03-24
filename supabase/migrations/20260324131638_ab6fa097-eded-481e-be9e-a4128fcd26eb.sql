
-- Service Orders table
CREATE TABLE public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  department text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL,
  assigned_to uuid NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can create service orders"
ON public.service_orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Any authenticated user can view service orders"
ON public.service_orders FOR SELECT TO authenticated
USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Admin/Manager can manage service orders"
ON public.service_orders FOR ALL TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Service Order Comments
CREATE TABLE public.service_order_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_order_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view comments"
ON public.service_order_comments FOR SELECT TO authenticated
USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Authenticated users can create comments"
ON public.service_order_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin/Manager can manage comments"
ON public.service_order_comments FOR ALL TO authenticated
USING (is_admin_or_manager(auth.uid()));

-- Admin Announcements
CREATE TABLE public.admin_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  image_url text NULL,
  link_url text NULL,
  link_text text NULL,
  target_type text NOT NULL DEFAULT 'all',
  target_user_ids uuid[] NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage announcements"
ON public.admin_announcements FOR ALL TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Authenticated users can view active announcements"
ON public.admin_announcements FOR SELECT TO authenticated
USING (is_active = true AND has_any_admin_role(auth.uid()));

CREATE TRIGGER update_admin_announcements_updated_at
  BEFORE UPDATE ON public.admin_announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Announcement Dismissals
CREATE TABLE public.announcement_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.admin_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals"
ON public.announcement_dismissals FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss announcements"
ON public.announcement_dismissals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
