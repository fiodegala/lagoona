INSERT INTO public.user_roles (user_id, role, store_id)
VALUES ('012fc7b0-6157-462d-b9bf-49465a3c69a9', 'seller'::app_role, '8c5a3cf3-7f68-4cf7-b1fa-10ce6debf64e')
ON CONFLICT DO NOTHING;