-- Create a table for sales goals
CREATE TABLE public.sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('daily', 'monthly')),
  target_amount NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint for type (only one active goal per type)
CREATE UNIQUE INDEX idx_sales_goals_type ON public.sales_goals(type) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin/Manager can manage sales goals" 
ON public.sales_goals 
FOR ALL 
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone with admin role can view goals" 
ON public.sales_goals 
FOR SELECT 
USING (has_any_admin_role(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_sales_goals_updated_at
BEFORE UPDATE ON public.sales_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default goals
INSERT INTO public.sales_goals (type, target_amount, is_active) VALUES 
  ('daily', 1000, true),
  ('monthly', 30000, true);