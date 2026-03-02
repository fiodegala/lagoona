
-- Add notified_at column to track when WhatsApp notification was sent
ALTER TABLE public.abandoned_carts ADD COLUMN notified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Enable pg_cron and pg_net extensions for scheduled function calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
