-- Enum para roles do admin
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'support');

-- Enum para status das API Keys
CREATE TYPE public.api_key_status AS ENUM ('active', 'revoked', 'expired');

-- Tabela de perfis de usuários admin
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela separada para roles (segurança)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'support',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, role)
);

-- Tabela de API Keys
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    public_key TEXT NOT NULL UNIQUE,
    secret_key_hash TEXT NOT NULL,
    status api_key_status DEFAULT 'active' NOT NULL,
    scopes TEXT[] DEFAULT '{}' NOT NULL,
    allowed_ips TEXT[] DEFAULT '{}',
    rate_limit_per_minute INTEGER DEFAULT 60 NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de logs de uso das API Keys
CREATE TABLE public.api_key_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    request_body_size INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela para anti-replay (nonces)
CREATE TABLE public.used_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce TEXT NOT NULL UNIQUE,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de produtos
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0 NOT NULL,
    category_id UUID,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de categorias
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Adicionar FK de categoria em produtos
ALTER TABLE public.products ADD CONSTRAINT fk_products_category 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- Tabela de pedidos
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE,
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    items JSONB NOT NULL,
    shipping_address JSONB,
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de configurações públicas
CREATE TABLE public.store_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de webhooks de pagamento
CREATE TABLE public.payment_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;

-- Função SECURITY DEFINER para verificar roles (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Função para verificar se usuário é admin ou manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'manager')
    )
$$;

-- Função para verificar se usuário tem qualquer role admin
CREATE OR REPLACE FUNCTION public.has_any_admin_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id
    )
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_config_updated_at BEFORE UPDATE ON public.store_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies para profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para user_roles (apenas admins)
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies para api_keys
CREATE POLICY "Admin/Manager can view API keys" ON public.api_keys FOR SELECT USING (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Admin/Manager can create API keys" ON public.api_keys FOR INSERT WITH CHECK (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Admin/Manager can update API keys" ON public.api_keys FOR UPDATE USING (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Admin can delete API keys" ON public.api_keys FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para api_key_logs
CREATE POLICY "Admin/Manager can view API key logs" ON public.api_key_logs FOR SELECT USING (public.is_admin_or_manager(auth.uid()));

-- RLS Policies para used_nonces (service role only via edge functions)
CREATE POLICY "Service role can manage nonces" ON public.used_nonces FOR ALL USING (true);

-- RLS Policies para products
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Admin/Manager can manage products" ON public.products FOR ALL USING (public.is_admin_or_manager(auth.uid()));

-- RLS Policies para categories
CREATE POLICY "Anyone can view active categories" ON public.categories FOR SELECT USING (is_active = true);
CREATE POLICY "Admin/Manager can manage categories" ON public.categories FOR ALL USING (public.is_admin_or_manager(auth.uid()));

-- RLS Policies para orders
CREATE POLICY "Admin/Manager/Support can view orders" ON public.orders FOR SELECT USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "Admin/Manager can manage orders" ON public.orders FOR ALL USING (public.is_admin_or_manager(auth.uid()));

-- RLS Policies para store_config
CREATE POLICY "Anyone can view public config" ON public.store_config FOR SELECT USING (is_public = true);
CREATE POLICY "Admin can manage config" ON public.store_config FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para payment_webhooks
CREATE POLICY "Admin/Manager can view webhooks" ON public.payment_webhooks FOR SELECT USING (public.is_admin_or_manager(auth.uid()));

-- Criar índices para performance
CREATE INDEX idx_api_keys_public_key ON public.api_keys(public_key);
CREATE INDEX idx_api_keys_status ON public.api_keys(status);
CREATE INDEX idx_api_key_logs_api_key_id ON public.api_key_logs(api_key_id);
CREATE INDEX idx_api_key_logs_created_at ON public.api_key_logs(created_at);
CREATE INDEX idx_used_nonces_nonce ON public.used_nonces(nonce);
CREATE INDEX idx_used_nonces_api_key_id ON public.used_nonces(api_key_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);

-- Limpar nonces antigos (executar periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_old_nonces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.used_nonces WHERE used_at < now() - INTERVAL '10 minutes';
END;
$$;