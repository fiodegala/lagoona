-- A tabela used_nonces é acessada apenas por edge functions com service role
-- Desabilitar RLS pois service role já bypassa RLS automaticamente
ALTER TABLE public.used_nonces DISABLE ROW LEVEL SECURITY;