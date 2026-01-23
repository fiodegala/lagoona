-- Reabilitar RLS em used_nonces com policy restritiva
ALTER TABLE public.used_nonces ENABLE ROW LEVEL SECURITY;

-- Policy que nega acesso a todos (apenas service role pode acessar, que bypassa RLS)
CREATE POLICY "No direct access to nonces" ON public.used_nonces FOR ALL USING (false);