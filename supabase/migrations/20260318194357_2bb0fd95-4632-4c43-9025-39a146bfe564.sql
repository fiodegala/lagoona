
CREATE TABLE public.instagram_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instagram_user_id text,
  instagram_username text,
  access_token text NOT NULL,
  token_type text DEFAULT 'short_lived',
  expires_at timestamp with time zone,
  scopes text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(instagram_user_id)
);

ALTER TABLE public.instagram_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage instagram integrations"
ON public.instagram_integrations FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));
