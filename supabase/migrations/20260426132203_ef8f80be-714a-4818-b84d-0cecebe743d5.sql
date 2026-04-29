
-- Seed demo users via direct insert into auth.users + profiles
DO $$
DECLARE
  v_alice UUID := '11111111-1111-1111-1111-111111111111';
  v_bob   UUID := '22222222-2222-2222-2222-222222222222';
  v_carol UUID := '33333333-3333-3333-3333-333333333333';
  v_pwd   TEXT := crypt('demo1234', gen_salt('bf'));
  v_pin   TEXT := crypt('1234', gen_salt('bf', 10));
BEGIN
  -- Insert into auth.users (idempotent)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change
  )
  SELECT v_alice, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'alice@demo.com', v_pwd, now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"full_name":"Alice Demo"}'::jsonb, false, '', '', '', ''
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email='alice@demo.com');

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change
  )
  SELECT v_bob, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'bob@demo.com', v_pwd, now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"full_name":"Bob Demo"}'::jsonb, false, '', '', '', ''
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email='bob@demo.com');

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change
  )
  SELECT v_carol, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'carol@demo.com', v_pwd, now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"full_name":"Carol Demo"}'::jsonb, false, '', '', '', ''
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email='carol@demo.com');

  -- Identities (needed for sign-in with password in some Supabase versions)
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), v_alice,
         jsonb_build_object('sub', v_alice::text, 'email', 'alice@demo.com', 'email_verified', true),
         'email', v_alice::text, now(), now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider='email' AND user_id=v_alice);

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), v_bob,
         jsonb_build_object('sub', v_bob::text, 'email', 'bob@demo.com', 'email_verified', true),
         'email', v_bob::text, now(), now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider='email' AND user_id=v_bob);

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), v_carol,
         jsonb_build_object('sub', v_carol::text, 'email', 'carol@demo.com', 'email_verified', true),
         'email', v_carol::text, now(), now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider='email' AND user_id=v_carol);

  -- Set PIN hash on profiles (trigger already created profile + wallets)
  UPDATE public.profiles SET pin_hash = v_pin, full_name='Alice Demo', preferred_currency='USD' WHERE id=v_alice;
  UPDATE public.profiles SET pin_hash = v_pin, full_name='Bob Demo',   preferred_currency='EUR' WHERE id=v_bob;
  UPDATE public.profiles SET pin_hash = v_pin, full_name='Carol Demo', preferred_currency='USD' WHERE id=v_carol;

  -- Seed balances
  UPDATE public.wallets SET balance=5000   WHERE user_id=v_alice AND currency='USD';
  UPDATE public.wallets SET balance=200000 WHERE user_id=v_alice AND currency='INR';
  UPDATE public.wallets SET balance=3000   WHERE user_id=v_bob   AND currency='EUR';
  UPDATE public.wallets SET balance=1500   WHERE user_id=v_bob   AND currency='GBP';
  UPDATE public.wallets SET balance=1200   WHERE user_id=v_carol AND currency='USD';
  UPDATE public.wallets SET balance=800    WHERE user_id=v_carol AND currency='EUR';
  UPDATE public.wallets SET balance=50000  WHERE user_id=v_carol AND currency='INR';
END $$;
