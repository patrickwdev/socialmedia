-- One-way follows: follower follows following (profiles.id = auth.users.id).

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint profile_follows_no_self check (follower_id <> following_id)
);

create index if not exists profile_follows_following_id_idx
  on public.profile_follows (following_id);

create index if not exists profile_follows_follower_id_idx
  on public.profile_follows (follower_id);

alter table public.profile_follows enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_follows'
      and policyname = 'profile_follows_authenticated_select'
  ) then
    create policy "profile_follows_authenticated_select"
      on public.profile_follows
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
      and tablename = 'profile_follows'
      and policyname = 'profile_follows_insert_own_row'
  ) then
    create policy "profile_follows_insert_own_row"
      on public.profile_follows
      for insert
      to authenticated
      with check (auth.uid() = follower_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_follows'
      and policyname = 'profile_follows_delete_own_row'
  ) then
    create policy "profile_follows_delete_own_row"
      on public.profile_follows
      for delete
      to authenticated
      using (auth.uid() = follower_id);
  end if;
end
$$;
