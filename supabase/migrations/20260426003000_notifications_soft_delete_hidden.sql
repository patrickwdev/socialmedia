alter table public.notifications
  add column if not exists hidden boolean not null default false;

create index if not exists notifications_recipient_hidden_updated_idx
  on public.notifications (recipient_id, hidden, updated_at desc);

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
      if v_existing.hidden then
        update public.notifications
        set hidden = false,
            read = false,
            updated_at = v_now
        where id = v_existing.id
        returning id into v_notification_id;
        return v_notification_id;
      end if;
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
        hidden = false,
        updated_at = v_now
    where id = v_existing.id
    returning id into v_notification_id;

    return v_notification_id;
  end if;

  insert into public.notifications (recipient_id, post_id, actor_ids, count, type, read, hidden, created_at, updated_at)
  values (p_recipient_id, p_post_id, array[p_actor_id]::uuid[], 1, 'like', false, false, v_now, v_now)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

grant execute on function public.add_like_notification(uuid, uuid, uuid) to authenticated;
