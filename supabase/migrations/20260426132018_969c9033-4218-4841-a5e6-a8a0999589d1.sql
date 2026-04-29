
-- Enable pgcrypto for bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Currency enum
CREATE TYPE public.currency_code AS ENUM ('USD', 'INR', 'EUR', 'GBP');
CREATE TYPE public.txn_type AS ENUM ('SEND', 'DEPOSIT', 'WITHDRAW');
CREATE TYPE public.txn_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  pin_hash TEXT,
  preferred_currency public.currency_code NOT NULL DEFAULT 'USD',
  pin_failed_attempts INT NOT NULL DEFAULT 0,
  pin_locked_until TIMESTAMPTZ,
  daily_limit_usd NUMERIC(18,2) NOT NULL DEFAULT 25000,
  max_txn_usd NUMERIC(18,2) NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallets (one row per user/currency)
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency public.currency_code NOT NULL,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL UNIQUE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.txn_type NOT NULL,
  original_amount NUMERIC(18,2) NOT NULL,
  original_currency public.currency_code NOT NULL,
  converted_amount NUMERIC(18,2) NOT NULL,
  converted_currency public.currency_code NOT NULL,
  exchange_rate NUMERIC(18,8) NOT NULL DEFAULT 1,
  status public.txn_status NOT NULL DEFAULT 'PENDING',
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_sender ON public.transactions(sender_id, created_at DESC);
CREATE INDEX idx_txn_receiver ON public.transactions(receiver_id, created_at DESC);

-- Ledger
CREATE TABLE public.ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  debit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency public.currency_code NOT NULL,
  balance_after NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_user ON public.ledger(user_id, created_at DESC);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/update their own; SELECT allowed for any authenticated user (lookup receiver by email)
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Wallets: only owner
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Transactions: visible to sender or receiver
CREATE POLICY "txn_select_party" ON public.transactions FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Ledger: only owner
CREATE POLICY "ledger_select_own" ON public.ledger FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  -- Create wallets for all currencies
  INSERT INTO public.wallets (user_id, currency, balance)
  SELECT NEW.id, c, 0 FROM unnest(ARRAY['USD','INR','EUR','GBP']::public.currency_code[]) c
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
