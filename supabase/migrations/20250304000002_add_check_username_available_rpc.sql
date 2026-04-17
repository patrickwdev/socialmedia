-- RPC for sign-up: check if a username is available (not already in profiles).
-- Returns true if the username can be used. Case-insensitive. Call from client before allowing "Continue".
-- SECURITY DEFINER allows reading profiles; anon can call this for sign-up UX only.

CREATE OR REPLACE FUNCTION public.check_username_available(check_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(TRIM(username)) = LOWER(TRIM(check_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon;
