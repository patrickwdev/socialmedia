-- Denormalized follow counts on profiles, kept in sync by triggers on profile_follows.

alter table public.profiles
  add column if not exists followers_count integer not null default 0,
  add column if not exists following_count integer not null default 0;

update public.profiles p
set
  followers_count = coalesce(
    (select count(*)::integer from public.profile_follows f where f.following_id = p.id),
    0
  ),
  following_count = coalesce(
    (select count(*)::integer from public.profile_follows f where f.follower_id = p.id),
    0
  );

create or replace function public.sync_profile_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set followers_count = followers_count + 1
    where id = new.following_id;
    update public.profiles
    set following_count = following_count + 1
    where id = new.follower_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set followers_count = greatest(0, followers_count - 1)
    where id = old.following_id;
    update public.profiles
    set following_count = greatest(0, following_count - 1)
    where id = old.follower_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists profile_follows_sync_counts on public.profile_follows;

create trigger profile_follows_sync_counts
  after insert or delete on public.profile_follows
  for each row
  execute function public.sync_profile_follow_counts();
