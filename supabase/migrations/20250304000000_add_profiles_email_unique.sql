-- Enforce unique email on profiles (run in Supabase SQL Editor if not using CLI).
-- Supabase Auth already keeps auth.users.email unique; this keeps public.profiles in sync.

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_email_key UNIQUE (email);
