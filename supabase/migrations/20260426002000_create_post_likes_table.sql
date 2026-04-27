create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_id_idx
  on public.post_likes (user_id);

create index if not exists post_likes_post_id_idx
  on public.post_likes (post_id);

alter table public.post_likes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'post_likes'
      and policyname = 'Authenticated users can read post likes'
  ) then
    create policy "Authenticated users can read post likes"
      on public.post_likes
      for select
      to authenticated
      using (true);
  end if;
end
$$;

drop function if exists public.set_post_like(uuid, uuid, boolean);
create or replace function public.set_post_like(
  p_post_id uuid,
  p_user_id uuid,
  p_like boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_like_count integer;
begin
  if p_post_id is null or p_user_id is null then
    raise exception 'post_id and user_id are required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'user must match auth user';
  end if;

  if p_like then
    insert into public.post_likes (post_id, user_id)
    values (p_post_id, p_user_id)
    on conflict (post_id, user_id) do nothing;
  else
    delete from public.post_likes
    where post_id = p_post_id
      and user_id = p_user_id;
  end if;

  select count(*)
  into v_like_count
  from public.post_likes
  where post_id = p_post_id;

  update public.posts
  set like_count = v_like_count
  where id = p_post_id;

  return v_like_count;
end;
$$;

grant execute on function public.set_post_like(uuid, uuid, boolean) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'post_likes'
      and policyname = 'Users can update own post likes'
  ) then
    create policy "Users can update own post likes"
      on public.post_likes
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'post_likes'
      and policyname = 'Users can insert own post likes'
  ) then
    create policy "Users can insert own post likes"
      on public.post_likes
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'post_likes'
      and policyname = 'Users can delete own post likes'
  ) then
    create policy "Users can delete own post likes"
      on public.post_likes
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;
