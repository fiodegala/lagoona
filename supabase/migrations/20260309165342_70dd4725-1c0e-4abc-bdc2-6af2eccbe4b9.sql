
-- Affiliates table
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  document text,
  referral_code text NOT NULL UNIQUE,
  commission_percent numeric NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'pending',
  balance_pending numeric NOT NULL DEFAULT 0,
  balance_available numeric NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  pix_key text,
  bank_name text,
  bank_agency text,
  bank_account text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin can manage affiliates" ON public.affiliates
  FOR ALL TO public
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Affiliates can view own data
CREATE POLICY "Affiliates can view own data" ON public.affiliates
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Affiliates can update own banking info
CREATE POLICY "Affiliates can update own data" ON public.affiliates
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public can insert (signup)
CREATE POLICY "Anyone can sign up as affiliate" ON public.affiliates
  FOR INSERT TO public
  WITH CHECK (true);

-- Affiliate Sales table
CREATE TABLE public.affiliate_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  sale_amount numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage affiliate sales" ON public.affiliate_sales
  FOR ALL TO public
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Affiliates can view own sales" ON public.affiliate_sales
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = affiliate_sales.affiliate_id AND a.user_id = auth.uid()
  ));

-- Affiliate Withdrawals table
CREATE TABLE public.affiliate_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pix_key text,
  bank_info jsonb,
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage withdrawals" ON public.affiliate_withdrawals
  FOR ALL TO public
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Affiliates can view own withdrawals" ON public.affiliate_withdrawals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = affiliate_withdrawals.affiliate_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Affiliates can request withdrawals" ON public.affiliate_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = affiliate_withdrawals.affiliate_id AND a.user_id = auth.uid() AND a.status = 'active'
  ));
