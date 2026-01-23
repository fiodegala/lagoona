-- Create table for product attributes (e.g., "Cor", "Tamanho")
CREATE TABLE public.product_attributes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for attribute values (e.g., "Azul", "P", "M", "G")
CREATE TABLE public.product_attribute_values (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    attribute_id UUID NOT NULL REFERENCES public.product_attributes(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for product variations (combinations with price/stock)
CREATE TABLE public.product_variations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT,
    price NUMERIC,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table linking variations to their attribute values
CREATE TABLE public.product_variation_values (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    variation_id UUID NOT NULL REFERENCES public.product_variations(id) ON DELETE CASCADE,
    attribute_value_id UUID NOT NULL REFERENCES public.product_attribute_values(id) ON DELETE CASCADE,
    UNIQUE(variation_id, attribute_value_id)
);

-- Enable RLS on all tables
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variation_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_attributes
CREATE POLICY "Admin/Manager can manage product attributes"
ON public.product_attributes
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view product attributes"
ON public.product_attributes
FOR SELECT
USING (true);

-- RLS Policies for product_attribute_values
CREATE POLICY "Admin/Manager can manage attribute values"
ON public.product_attribute_values
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view attribute values"
ON public.product_attribute_values
FOR SELECT
USING (true);

-- RLS Policies for product_variations
CREATE POLICY "Admin/Manager can manage product variations"
ON public.product_variations
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view active product variations"
ON public.product_variations
FOR SELECT
USING (is_active = true);

-- RLS Policies for product_variation_values
CREATE POLICY "Admin/Manager can manage variation values"
ON public.product_variation_values
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view variation values"
ON public.product_variation_values
FOR SELECT
USING (true);

-- Create trigger for updating updated_at on product_variations
CREATE TRIGGER update_product_variations_updated_at
BEFORE UPDATE ON public.product_variations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();