
-- Fix search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ PIN management ============
CREATE OR REPLACE FUNCTION public.set_user_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;
  UPDATE public.profiles
  SET pin_hash = crypt(p_pin, gen_salt('bf', 10)),
      pin_failed_attempts = 0,
      pin_locked_until = NULL
  WHERE id = uid;
END;
$$;

-- Verify pin: returns TRUE/FALSE, manages lockout
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_attempts INT;
  v_locked TIMESTAMPTZ;
  v_ok BOOLEAN;
BEGIN
  SELECT pin_hash, pin_failed_attempts, pin_locked_until
  INTO v_hash, v_attempts, v_locked
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_hash IS NULL THEN RAISE EXCEPTION 'PIN not set'; END IF;
  IF v_locked IS NOT NULL AND v_locked > now() THEN
    RAISE EXCEPTION 'PIN locked until %', v_locked;
  END IF;

  v_ok := (v_hash = crypt(p_pin, v_hash));
  IF v_ok THEN
    UPDATE public.profiles SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = p_user_id;
  ELSE
    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN
      UPDATE public.profiles SET pin_failed_attempts = 0, pin_locked_until = now() + interval '5 minutes' WHERE id = p_user_id;
    ELSE
      UPDATE public.profiles SET pin_failed_attempts = v_attempts WHERE id = p_user_id;
    END IF;
  END IF;
  RETURN v_ok;
END;
$$;

-- ============ ATOMIC TRANSACTION RPC ============
CREATE OR REPLACE FUNCTION public.process_transaction(
  p_idempotency_key UUID,
  p_type public.txn_type,
  p_pin TEXT,
  p_original_amount NUMERIC,
  p_original_currency public.currency_code,
  p_exchange_rate NUMERIC,           -- locked rate to convert to receiver currency
  p_receiver_email TEXT DEFAULT NULL -- only for SEND
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_receiver UUID;
  v_receiver_currency public.currency_code;
  v_converted NUMERIC;
  v_target_currency public.currency_code;
  v_sender_balance NUMERIC;
  v_receiver_balance NUMERIC;
  v_existing public.transactions;
  v_txn public.transactions;
  v_pin_ok BOOLEAN;
  v_max_usd NUMERIC;
  v_daily_usd NUMERIC;
  v_today_total_usd NUMERIC;
  v_amount_usd NUMERIC;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_original_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  -- 1) Idempotency: return existing if already processed
  SELECT * INTO v_existing FROM public.transactions WHERE idempotency_key = p_idempotency_key;
  IF FOUND AND v_existing.status = 'SUCCESS' THEN
    RETURN v_existing;
  END IF;

  -- 2) Verify PIN
  v_pin_ok := public.verify_user_pin(v_sender, p_pin);
  IF NOT v_pin_ok THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  -- 3) Limits (USD-equivalent; for non-USD we approximate using exchange_rate when sender is USD,
  --    otherwise we treat original_amount as usd-equivalent best-effort)
  SELECT max_txn_usd, daily_limit_usd INTO v_max_usd, v_daily_usd FROM public.profiles WHERE id = v_sender;
  v_amount_usd := CASE WHEN p_original_currency = 'USD' THEN p_original_amount
                       ELSE p_original_amount / NULLIF(p_exchange_rate, 0) END;
  IF v_amount_usd > v_max_usd THEN RAISE EXCEPTION 'Exceeds max transaction limit'; END IF;

  IF p_type = 'SEND' THEN
    SELECT COALESCE(SUM(CASE WHEN original_currency = 'USD' THEN original_amount
                             ELSE original_amount / NULLIF(exchange_rate,0) END), 0)
    INTO v_today_total_usd
    FROM public.transactions
    WHERE sender_id = v_sender AND type='SEND' AND status='SUCCESS'
      AND created_at >= date_trunc('day', now());
    IF v_today_total_usd + v_amount_usd > v_daily_usd THEN
      RAISE EXCEPTION 'Daily transfer limit exceeded';
    END IF;
  END IF;

  -- 4) Resolve receiver (for SEND)
  IF p_type = 'SEND' THEN
    IF p_receiver_email IS NULL THEN RAISE EXCEPTION 'Receiver email required'; END IF;
    SELECT id, preferred_currency INTO v_receiver, v_receiver_currency
    FROM public.profiles WHERE lower(email) = lower(p_receiver_email);
    IF v_receiver IS NULL THEN RAISE EXCEPTION 'Receiver not found'; END IF;
    IF v_receiver = v_sender THEN RAISE EXCEPTION 'Self-transfer not allowed'; END IF;
    v_target_currency := v_receiver_currency;
    v_converted := round(p_original_amount * p_exchange_rate, 2);
  ELSE
    v_target_currency := p_original_currency;
    v_converted := p_original_amount;
  END IF;

  -- 5) Lock relevant wallets
  IF p_type IN ('SEND','WITHDRAW') THEN
    SELECT balance INTO v_sender_balance
    FROM public.wallets
    WHERE user_id = v_sender AND currency = p_original_currency
    FOR UPDATE;
    IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Sender wallet missing'; END IF;
    IF v_sender_balance < p_original_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  END IF;

  IF p_type = 'SEND' THEN
    SELECT balance INTO v_receiver_balance
    FROM public.wallets
    WHERE user_id = v_receiver AND currency = v_target_currency
    FOR UPDATE;
    IF v_receiver_balance IS NULL THEN
      INSERT INTO public.wallets (user_id, currency, balance) VALUES (v_receiver, v_target_currency, 0)
      RETURNING balance INTO v_receiver_balance;
    END IF;
  END IF;

  -- 6) Insert / update transaction row
  IF FOUND AND v_existing.id IS NOT NULL THEN
    UPDATE public.transactions
    SET status='PENDING', failure_reason=NULL,
        original_amount=p_original_amount, original_currency=p_original_currency,
        converted_amount=v_converted, converted_currency=v_target_currency,
        exchange_rate=p_exchange_rate, sender_id=v_sender, receiver_id=v_receiver, type=p_type
    WHERE id = v_existing.id RETURNING * INTO v_txn;
  ELSE
    INSERT INTO public.transactions (
      idempotency_key, sender_id, receiver_id, type,
      original_amount, original_currency, converted_amount, converted_currency,
      exchange_rate, status
    ) VALUES (
      p_idempotency_key,
      CASE WHEN p_type='DEPOSIT' THEN NULL ELSE v_sender END,
      CASE WHEN p_type='SEND' THEN v_receiver
           WHEN p_type='DEPOSIT' THEN v_sender
           ELSE NULL END,
      p_type, p_original_amount, p_original_currency,
      v_converted, v_target_currency, p_exchange_rate, 'PENDING'
    ) RETURNING * INTO v_txn;
  END IF;

  -- 7) Mutate balances + ledger
  IF p_type IN ('SEND','WITHDRAW') THEN
    UPDATE public.wallets SET balance = balance - p_original_amount
    WHERE user_id = v_sender AND currency = p_original_currency
    RETURNING balance INTO v_sender_balance;

    INSERT INTO public.ledger (user_id, transaction_id, debit_amount, currency, balance_after)
    VALUES (v_sender, v_txn.id, p_original_amount, p_original_currency, v_sender_balance);
  END IF;

  IF p_type IN ('SEND','DEPOSIT') THEN
    DECLARE
      v_credit_user UUID := CASE WHEN p_type='SEND' THEN v_receiver ELSE v_sender END;
      v_credit_amt NUMERIC := v_converted;
      v_credit_cur public.currency_code := v_target_currency;
      v_new_bal NUMERIC;
    BEGIN
      INSERT INTO public.wallets (user_id, currency, balance) VALUES (v_credit_user, v_credit_cur, 0)
      ON CONFLICT (user_id, currency) DO NOTHING;

      UPDATE public.wallets SET balance = balance + v_credit_amt
      WHERE user_id = v_credit_user AND currency = v_credit_cur
      RETURNING balance INTO v_new_bal;

      INSERT INTO public.ledger (user_id, transaction_id, credit_amount, currency, balance_after)
      VALUES (v_credit_user, v_txn.id, v_credit_amt, v_credit_cur, v_new_bal);
    END;
  END IF;

  -- 8) Mark success
  UPDATE public.transactions SET status='SUCCESS' WHERE id = v_txn.id RETURNING * INTO v_txn;
  RETURN v_txn;

EXCEPTION WHEN OTHERS THEN
  -- Best-effort: record failure if a transaction row exists
  BEGIN
    UPDATE public.transactions SET status='FAILED', failure_reason=SQLERRM
    WHERE idempotency_key = p_idempotency_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_transaction(UUID, public.txn_type, TEXT, NUMERIC, public.currency_code, NUMERIC, TEXT) TO authenticated;
