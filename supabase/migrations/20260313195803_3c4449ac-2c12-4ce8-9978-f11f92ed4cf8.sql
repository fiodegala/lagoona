-- Fix imported sales: assign correct user_id based on seller name in payment_details
UPDATE pos_sales 
SET user_id = '4def8fe6-e848-413b-8223-98d06d9ba586'
WHERE notes LIKE '%Importado da planilha%' 
AND payment_details->>'seller' ILIKE '%myrelle%';

UPDATE pos_sales 
SET user_id = '7636d516-c860-4fe3-b288-a5b41efee1ad'
WHERE notes LIKE '%Importado da planilha%' 
AND payment_details->>'seller' ILIKE '%carol%';