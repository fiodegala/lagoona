ALTER TABLE public.pos_sales
DROP CONSTRAINT IF EXISTS pos_sales_payment_method_check;

ALTER TABLE public.pos_sales
ADD CONSTRAINT pos_sales_payment_method_check
CHECK (payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'pix'::text, 'mixed'::text, 'boleto'::text, 'cheque'::text]));