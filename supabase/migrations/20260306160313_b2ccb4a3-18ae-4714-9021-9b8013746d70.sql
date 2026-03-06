ALTER TABLE public.customers 
ADD COLUMN address_number text DEFAULT NULL,
ADD COLUMN address_complement text DEFAULT NULL,
ADD COLUMN neighborhood text DEFAULT NULL;