-- Add barcode field to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Create index for barcode lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- Create pos_sessions table for cash register sessions
CREATE TABLE public.pos_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closed_at TIMESTAMP WITH TIME ZONE,
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    closing_balance NUMERIC,
    expected_balance NUMERIC,
    difference NUMERIC,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pos_sessions
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for pos_sessions
CREATE POLICY "Admin/Manager can manage POS sessions"
ON public.pos_sessions
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can view their own sessions"
ON public.pos_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Create pos_transactions table for cash movements
CREATE TABLE public.pos_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.pos_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sale', 'withdrawal', 'deposit', 'opening', 'closing')),
    amount NUMERIC NOT NULL,
    payment_method TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID
);

-- Enable RLS on pos_transactions
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for pos_transactions
CREATE POLICY "Admin/Manager can manage POS transactions"
ON public.pos_transactions
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can view transactions from their sessions"
ON public.pos_transactions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.pos_sessions 
        WHERE pos_sessions.id = pos_transactions.session_id 
        AND pos_sessions.user_id = auth.uid()
    )
);

-- Create pos_sales table for PDV sales
CREATE TABLE public.pos_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id UUID NOT NULL UNIQUE,
    session_id UUID REFERENCES public.pos_sessions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    customer_name TEXT,
    customer_document TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC NOT NULL,
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'pix', 'mixed')),
    payment_details JSONB DEFAULT '{}',
    amount_received NUMERIC,
    change_amount NUMERIC DEFAULT 0,
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    coupon_code TEXT,
    notes TEXT,
    synced BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pos_sales
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;

-- Policies for pos_sales
CREATE POLICY "Admin/Manager can manage POS sales"
ON public.pos_sales
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can view their own sales"
ON public.pos_sales
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create sales"
ON public.pos_sales
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pos_sessions_user_id ON public.pos_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_status ON public.pos_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_session_id ON public.pos_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_session_id ON public.pos_sales(session_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_user_id ON public.pos_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_local_id ON public.pos_sales(local_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_synced ON public.pos_sales(synced);

-- Add trigger for updated_at
CREATE TRIGGER update_pos_sessions_updated_at
    BEFORE UPDATE ON public.pos_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_sales_updated_at
    BEFORE UPDATE ON public.pos_sales
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();