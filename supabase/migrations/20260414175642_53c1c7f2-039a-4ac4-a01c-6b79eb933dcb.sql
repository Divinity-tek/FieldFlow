
-- Wallet owner type
CREATE TYPE public.wallet_owner_type AS ENUM ('client', 'engineer');

-- Transaction types
CREATE TYPE public.wallet_transaction_type AS ENUM ('deposit', 'withdrawal', 'payment', 'payout', 'refund', 'adjustment');

-- Payout status
CREATE TYPE public.payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_type wallet_owner_type NOT NULL,
  owner_id UUID NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id)
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type wallet_transaction_type NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Engineer payouts
CREATE TABLE public.engineer_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  payout_method TEXT DEFAULT 'bank_transfer',
  notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.engineer_payouts ENABLE ROW LEVEL SECURITY;

-- Updated at triggers
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_engineer_payouts_updated_at BEFORE UPDATE ON public.engineer_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ RLS POLICIES ═══

-- Wallets: Admin/team lead full access
CREATE POLICY "Admins can manage all wallets" ON public.wallets
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can manage all wallets" ON public.wallets
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'team_lead'));

-- Clients see own wallet
CREATE POLICY "Clients can view own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (
    owner_type = 'client' AND owner_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- Engineers see own wallet
CREATE POLICY "Engineers can view own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (
    owner_type = 'engineer' AND owner_id IN (
      SELECT id FROM public.engineers WHERE user_id = auth.uid()
    )
  );

-- Partners see client wallets
CREATE POLICY "Partners can view client wallets" ON public.wallets
  FOR SELECT TO authenticated USING (
    owner_type = 'client' AND owner_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.partner_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid())
    )
  );

-- Wallet transactions: Admin/team lead full access
CREATE POLICY "Admins can manage all transactions" ON public.wallet_transactions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can view all transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'team_lead'));

-- Clients see own transactions
CREATE POLICY "Clients can view own transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (
    wallet_id IN (
      SELECT w.id FROM public.wallets w
      WHERE w.owner_type = 'client' AND w.owner_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      )
    )
  );

-- Engineers see own transactions
CREATE POLICY "Engineers can view own transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (
    wallet_id IN (
      SELECT w.id FROM public.wallets w
      WHERE w.owner_type = 'engineer' AND w.owner_id IN (
        SELECT id FROM public.engineers WHERE user_id = auth.uid()
      )
    )
  );

-- Engineer payouts: Admin/team lead full access
CREATE POLICY "Admins can manage all payouts" ON public.engineer_payouts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can manage all payouts" ON public.engineer_payouts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'team_lead'));

-- Engineers see own payouts + create
CREATE POLICY "Engineers can view own payouts" ON public.engineer_payouts
  FOR SELECT TO authenticated USING (
    engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  );

CREATE POLICY "Engineers can create own payouts" ON public.engineer_payouts
  FOR INSERT TO authenticated WITH CHECK (
    engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  );
