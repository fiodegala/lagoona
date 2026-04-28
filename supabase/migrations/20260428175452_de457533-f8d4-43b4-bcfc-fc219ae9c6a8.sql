ALTER TABLE public.service_orders REPLICA IDENTITY FULL;
ALTER TABLE public.admin_announcements REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_announcements;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;