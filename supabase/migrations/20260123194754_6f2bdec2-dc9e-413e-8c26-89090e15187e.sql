-- Corrigir search_path nas funções que faltaram
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Remover policy permissiva e criar uma mais restritiva para used_nonces
DROP POLICY IF EXISTS "Service role can manage nonces" ON public.used_nonces;

-- Nonces só podem ser gerenciados via service role (edge functions)
-- A tabela não precisa de RLS pois só é acessada por edge functions com service role