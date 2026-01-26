-- Add customer_id to orders table
ALTER TABLE public.orders 
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Add customer_id to pos_sales table
ALTER TABLE public.pos_sales 
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_pos_sales_customer_id ON public.pos_sales(customer_id);