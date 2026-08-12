CREATE TABLE IF NOT EXISTS public.tiktok_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  seller_name text,
  open_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tiktok_auth TO service_role;
ALTER TABLE public.tiktok_auth ENABLE ROW LEVEL SECURITY;