create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '',
  content text not null default '',
  assets jsonb,
  type text not null check (type in ('video', 'image', 'text')),
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  is_live boolean not null default false,
  user_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

alter table public.posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'Public can read posts'
  ) then
    create policy "Public can read posts"
      on public.posts for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'Authenticated users can insert own posts'
  ) then
    create policy "Authenticated users can insert own posts"
      on public.posts for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'Users can delete own posts'
  ) then
    create policy "Users can delete own posts"
      on public.posts for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;
