-- RPC for sign-up: check if an email is available (not already in auth.users).
-- Returns true if the email can be used for sign-up. Call from client before allowing "Continue".
-- SECURITY DEFINER allows reading auth.users; anon can call this for sign-up UX only.

CREATE OR REPLACE FUNCTION public.check_email_available(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM auth.users WHERE email = check_email);
$$;

GRANT EXECUTE ON FUNCTION public.check_email_available(text) TO anon;
