-- Relax fan target role guard: allow fan edges when role is unset/null.
-- Still blocks explicit non-athlete roles.

create or replace function public.ensure_profile_fan_target_is_athlete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  select lower(coalesce(role, '')) into target_role
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
