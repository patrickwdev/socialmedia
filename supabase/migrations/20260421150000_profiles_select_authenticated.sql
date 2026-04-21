-- Username search in compose (Tag) needs to read other users' profile rows.
-- Only runs when RLS is already enabled on public.profiles (avoids enabling RLS unexpectedly).

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and c.relrowsecurity = true
  )
  and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_authenticated_select'
  ) then
    create policy "profiles_authenticated_select"
      on public.profiles
      for select
      to authenticated
      using (true);
  end if;
end
$$;
