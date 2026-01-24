-- Create measurement table templates linked to categories
CREATE TABLE public.measurement_tables (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Tabela de Medidas',
    columns JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of column definitions: [{name: "Largura", unit: "cm"}, ...]
    rows JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of row data: [{size: "P", values: {"Largura": "50", "Comprimento": "70"}}, ...]
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.measurement_tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin/Manager can manage measurement tables"
ON public.measurement_tables
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can view measurement tables"
ON public.measurement_tables
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_measurement_tables_updated_at
    BEFORE UPDATE ON public.measurement_tables
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint for one measurement table per category
ALTER TABLE public.measurement_tables 
ADD CONSTRAINT unique_category_measurement UNIQUE (category_id);