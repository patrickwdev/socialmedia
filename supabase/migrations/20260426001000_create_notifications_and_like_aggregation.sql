create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  actor_ids uuid[] not null default '{}'::uuid[],
  count integer not null default 0 check (count >= 0),
  type text not null check (type = 'like'),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_like_lookup_idx
  on public.notifications (recipient_id, post_id, type, updated_at desc);

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Users can read own notifications'
  ) then
    create policy "Users can read own notifications"
      on public.notifications
      for select
      to authenticated
      using (auth.uid() = recipient_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Users can update own notifications'
  ) then
    create policy "Users can update own notifications"
      on public.notifications
      for update
      to authenticated
      using (auth.uid() = recipient_id)
      with check (auth.uid() = recipient_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Users can delete own notifications'
  ) then
    create policy "Users can delete own notifications"
      on public.notifications
      for delete
      to authenticated
      using (auth.uid() = recipient_id);
  end if;
end
$$;

create or replace function public.set_notifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row
execute procedure public.set_notifications_updated_at();

drop function if exists public.add_like_notification(uuid, uuid, uuid);
create or replace function public.add_like_notification(
  p_post_id uuid,
  p_actor_id uuid,
  p_recipient_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_recent_window timestamptz := v_now - interval '5 minutes';
  v_existing notifications%rowtype;
  v_actor_ids uuid[];
  v_notification_id uuid;
begin
  if p_actor_id is null or p_recipient_id is null or p_post_id is null then
    return null;
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor must match auth user';
  end if;

  if p_actor_id = p_recipient_id then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_recipient_id::text || ':' || p_post_id::text, 0));

  select *
  into v_existing
  from public.notifications
  where recipient_id = p_recipient_id
    and post_id = p_post_id
    and type = 'like'
  order by updated_at desc, id desc
  limit 1
  for update;

  if found and v_existing.updated_at >= v_recent_window then
    if p_actor_id = any(coalesce(v_existing.actor_ids, '{}'::uuid[])) then
      return v_existing.id;
    end if;

    v_actor_ids := coalesce(v_existing.actor_ids, '{}'::uuid[]) || p_actor_id;
    if cardinality(v_actor_ids) > 5 then
      v_actor_ids := v_actor_ids[(cardinality(v_actor_ids) - 4):cardinality(v_actor_ids)];
    end if;

    update public.notifications
    set actor_ids = v_actor_ids,
        count = v_existing.count + 1,
        read = false,
        updated_at = v_now
    where id = v_existing.id
    returning id into v_notification_id;

    return v_notification_id;
  end if;

  insert into public.notifications (recipient_id, post_id, actor_ids, count, type, read, created_at, updated_at)
  values (p_recipient_id, p_post_id, array[p_actor_id]::uuid[], 1, 'like', false, v_now, v_now)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

drop function if exists public.remove_like_notification(uuid, uuid, uuid);
create or replace function public.remove_like_notification(
  p_post_id uuid,
  p_actor_id uuid,
  p_recipient_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing notifications%rowtype;
  v_actor_ids uuid[];
  v_notification_id uuid;
  v_next_count integer;
begin
  if p_actor_id is null or p_recipient_id is null or p_post_id is null then
    return null;
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor must match auth user';
  end if;

  if p_actor_id = p_recipient_id then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_recipient_id::text || ':' || p_post_id::text, 0));

  select *
  into v_existing
  from public.notifications
  where recipient_id = p_recipient_id
    and post_id = p_post_id
    and type = 'like'
    and p_actor_id = any(coalesce(actor_ids, '{}'::uuid[]))
  order by updated_at desc, id desc
  limit 1
  for update;

  if not found then
    return null;
  end if;

  select coalesce(array_agg(a), '{}'::uuid[])
  into v_actor_ids
  from unnest(coalesce(v_existing.actor_ids, '{}'::uuid[])) as a
  where a <> p_actor_id;

  v_next_count := greatest(v_existing.count - 1, 0);

  if v_next_count = 0 then
    delete from public.notifications
    where id = v_existing.id
    returning id into v_notification_id;

    return v_notification_id;
  end if;

  update public.notifications
  set actor_ids = v_actor_ids,
      count = v_next_count,
      updated_at = now()
  where id = v_existing.id
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

grant execute on function public.add_like_notification(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_like_notification(uuid, uuid, uuid) to authenticated;
