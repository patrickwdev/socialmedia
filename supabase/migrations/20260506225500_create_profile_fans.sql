-- One-way fan edges: user (fan_id) can fan an athlete (athlete_id).

create table if not exists public.profile_fans (
  fan_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fan_id, athlete_id),
  constraint profile_fans_no_self check (fan_id <> athlete_id)
);

create index if not exists profile_fans_athlete_id_idx
  on public.profile_fans (athlete_id);

create index if not exists profile_fans_fan_id_idx
  on public.profile_fans (fan_id);

alter table public.profile_fans enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_fans'
      and policyname = 'profile_fans_authenticated_select'
  ) then
    create policy "profile_fans_authenticated_select"
      on public.profile_fans
      for select
      to authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_fans'
      and policyname = 'profile_fans_insert_own_row'
  ) then
    create policy "profile_fans_insert_own_row"
      on public.profile_fans
      for insert
      to authenticated
      with check (auth.uid() = fan_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_fans'
      and policyname = 'profile_fans_delete_own_row'
  ) then
    create policy "profile_fans_delete_own_row"
      on public.profile_fans
      for delete
      to authenticated
      using (auth.uid() = fan_id);
  end if;
end
$$;

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
  if target_role <> 'athlete' then
    raise exception 'Only athlete profiles can be fanned';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_fans_target_role_guard on public.profile_fans;

create trigger profile_fans_target_role_guard
  before insert on public.profile_fans
  for each row
  execute function public.ensure_profile_fan_target_is_athlete();

alter table public.profiles
  add column if not exists fans_count integer not null default 0;

update public.profiles p
set fans_count = coalesce(
  (select count(*)::integer from public.profile_fans f where f.athlete_id = p.id),
  0
);

create or replace function public.sync_profile_fan_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set fans_count = fans_count + 1
    where id = new.athlete_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set fans_count = greatest(0, fans_count - 1)
    where id = old.athlete_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists profile_fans_sync_counts on public.profile_fans;

create trigger profile_fans_sync_counts
  after insert or delete on public.profile_fans
  for each row
  execute function public.sync_profile_fan_counts();
