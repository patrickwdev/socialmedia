-- Fix profile_fans target guard for nullable enum roles.
-- Coalescing the enum directly with '' makes Postgres cast '' to profile_role.

create or replace function public.ensure_profile_fan_target_is_athlete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  select lower(coalesce(role::text, '')) into target_role
  from public.profiles
  where id = new.athlete_id;

  -- Legacy/incomplete profile rows may have no role stored yet.
  -- Allow empty role and enforce only when a concrete non-athlete role exists.
  if target_role in ('fan', 'coach', 'scout') then
    raise exception 'Only athlete profiles can be fanned';
  end if;

  return new;
end;
$$;
