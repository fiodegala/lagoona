
-- Analytics events table for tracking user behavior
CREATE TABLE public.site_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  event_type text NOT NULL, -- 'page_view', 'click', 'product_view', 'add_to_cart', 'checkout_start', 'checkout_complete'
  page_path text NOT NULL,
  page_title text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  element_id text, -- for click tracking
  element_text text, -- button/link text clicked
  element_area text, -- 'header', 'hero', 'products', 'footer', etc.
  duration_ms integer, -- time spent on page
  metadata jsonb DEFAULT '{}'::jsonb,
  user_agent text,
  screen_width integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_analytics_session ON public.site_analytics_events(session_id);
CREATE INDEX idx_analytics_event_type ON public.site_analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON public.site_analytics_events(created_at);
CREATE INDEX idx_analytics_page_path ON public.site_analytics_events(page_path);
CREATE INDEX idx_analytics_product_id ON public.site_analytics_events(product_id);

-- RLS
ALTER TABLE public.site_analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (anonymous tracking)
CREATE POLICY "Anyone can insert analytics events"
ON public.site_analytics_events FOR INSERT
WITH CHECK (true);

-- Only admin/manager can view
CREATE POLICY "Admin/Manager can view analytics"
ON public.site_analytics_events FOR SELECT
USING (is_admin_or_manager(auth.uid()));

-- Admin can delete old data
CREATE POLICY "Admin can delete analytics"
ON public.site_analytics_events FOR DELETE
USING (is_admin_or_manager(auth.uid()));
