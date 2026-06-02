ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config;
ALTER TABLE public.store_config REPLICA IDENTITY FULL;