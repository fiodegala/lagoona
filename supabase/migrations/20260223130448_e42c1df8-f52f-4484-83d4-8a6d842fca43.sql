
-- 1. Create stores table
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('physical', 'online')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Everyone with any role can view stores
CREATE POLICY "Anyone with role can view stores" ON public.stores
  FOR SELECT USING (has_any_admin_role(auth.uid()));

-- Admin can manage stores
CREATE POLICY "Admin can manage stores" ON public.stores
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Insert the 3 initial stores
INSERT INTO public.stores (name, slug, type) VALUES
  ('Hyper Modas 44', 'hyper-modas-44', 'physical'),
  ('Bernardo Sayão', 'bernardo-sayao', 'physical'),
  ('Online', 'online', 'online');

-- 3. Create store_stock table
CREATE TABLE public.store_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id, variation_id)
);

ALTER TABLE public.store_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone with role can view store stock" ON public.store_stock
  FOR SELECT USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Admin/Manager can manage store stock" ON public.store_stock
  FOR ALL USING (is_admin_or_manager(auth.uid()));

-- 4. Add store_id to user_roles (nullable for admins who access all)
ALTER TABLE public.user_roles ADD COLUMN store_id uuid REFERENCES public.stores(id);

-- 5. Add store_id to pos_sessions
ALTER TABLE public.pos_sessions ADD COLUMN store_id uuid REFERENCES public.stores(id);

-- 6. Add store_id to pos_sales
ALTER TABLE public.pos_sales ADD COLUMN store_id uuid REFERENCES public.stores(id);

-- 7. Add store_id to orders
ALTER TABLE public.orders ADD COLUMN store_id uuid REFERENCES public.stores(id);

-- 8. Create function to get user's store_id
CREATE OR REPLACE FUNCTION public.user_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 9. Create function to check if user's store is online type
CREATE OR REPLACE FUNCTION public.is_online_store_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.stores s ON s.id = ur.store_id
    WHERE ur.user_id = _user_id AND s.type = 'online'
  )
$$;
