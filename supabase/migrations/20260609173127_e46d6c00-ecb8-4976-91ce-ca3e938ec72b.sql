UPDATE public.pos_sales
SET payment_details = payment_details - 'sale_origin'
WHERE payment_details ? 'sale_origin';