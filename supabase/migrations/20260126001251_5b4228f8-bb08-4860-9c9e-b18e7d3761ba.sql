-- Add 'seller' role to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';

-- Update the is_admin_or_manager function to include seller check
CREATE OR REPLACE FUNCTION public.can_manage_products(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'manager')
    )
$$;

-- Function to check if user can manage users (only admin)
CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = 'admin'
    )
$$;

-- Function to check if user can manage goals (only admin and manager)
CREATE OR REPLACE FUNCTION public.can_manage_goals(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'manager')
    )
$$;