create table if not exists public.user_push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_push_token)
);

create unique index if not exists user_push_tokens_expo_push_token_key
  on public.user_push_tokens (expo_push_token);

create index if not exists user_push_tokens_user_id_idx
  on public.user_push_tokens (user_id);

alter table public.user_push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_push_tokens'
      and policyname = 'Users can read own push tokens'
  ) then
    create policy "Users can read own push tokens"
      on public.user_push_tokens
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_push_tokens'
      and policyname = 'Users can insert own push tokens'
  ) then
    create policy "Users can insert own push tokens"
      on public.user_push_tokens
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
      and tablename = 'user_push_tokens'
      and policyname = 'Users can update own push tokens'
  ) then
    create policy "Users can update own push tokens"
      on public.user_push_tokens
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
      and tablename = 'user_push_tokens'
      and policyname = 'Users can delete own push tokens'
  ) then
    create policy "Users can delete own push tokens"
      on public.user_push_tokens
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

create or replace function public.set_user_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_push_tokens_updated_at on public.user_push_tokens;
create trigger set_user_push_tokens_updated_at
before update on public.user_push_tokens
for each row
execute procedure public.set_user_push_tokens_updated_at();
