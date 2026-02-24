-- Add credit_balance column to customers table
ALTER TABLE public.customers
ADD COLUMN credit_balance numeric NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.credit_balance IS 'Saldo de crédito do cliente para uso em próximas compras (gerado por trocas)';
