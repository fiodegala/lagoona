
-- Product combos table
CREATE TABLE public.product_combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  combo_price numeric NOT NULL,
  free_shipping boolean NOT NULL DEFAULT false,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Combo items table
CREATE TABLE public.product_combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1
);

-- Enable RLS
ALTER TABLE public.product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;

-- RLS for product_combos
CREATE POLICY "Admin/Manager can manage combos" ON public.product_combos
  FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view active combos" ON public.product_combos
  FOR SELECT USING (is_active = true);

-- RLS for product_combo_items
CREATE POLICY "Admin/Manager can manage combo items" ON public.product_combo_items
  FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view combo items" ON public.product_combo_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.product_combos
      WHERE product_combos.id = product_combo_items.combo_id
      AND product_combos.is_active = true
    )
  );
