-- Keep public.profiles in sync with auth.users metadata used by public profile routes.
-- Adds profile fields if missing, backfills from existing auth users, and creates a trigger.

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists role public.profile_role,
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists sport text,
  add column if not exists team text,
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists org_name text,
  add column if not exists role_title text,
  add column if not exists linkedin_link text,
  add column if not exists birthday text,
  add column if not exists links jsonb;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  meta_username text;
  meta_display_name text;
  meta_role public.profile_role;
  meta_avatar_url text;
  meta_banner_url text;
  meta_sport text;
  meta_team text;
  meta_bio text;
  meta_location text;
  meta_org_name text;
  meta_role_title text;
  meta_linkedin_link text;
  meta_birthday text;
  meta_links jsonb;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  meta_username := nullif(trim(meta ->> 'username'), '');
  meta_display_name := nullif(trim(coalesce(meta ->> 'profile_name', meta ->> 'full_name')), '');
  meta_role := case
    when lower(coalesce(trim(meta ->> 'role'), '')) in ('athlete', 'fan', 'scout', 'coach')
      then lower(trim(meta ->> 'role'))::public.profile_role
    else null
  end;
  meta_avatar_url := nullif(trim(meta ->> 'avatar_url'), '');
  meta_banner_url := nullif(trim(meta ->> 'banner_url'), '');
  meta_sport := nullif(trim(meta ->> 'sport'), '');
  meta_team := nullif(trim(meta ->> 'team'), '');
  meta_bio := nullif(trim(meta ->> 'bio'), '');
  meta_location := nullif(trim(meta ->> 'location'), '');
  meta_org_name := nullif(trim(meta ->> 'org_name'), '');
  meta_role_title := nullif(trim(meta ->> 'role_title'), '');
  meta_linkedin_link := nullif(trim(meta ->> 'linkedin_link'), '');
  meta_birthday := nullif(trim(meta ->> 'birthday'), '');
  meta_links := case when jsonb_typeof(meta -> 'links') = 'array' then meta -> 'links' else null end;

  insert into public.profiles (
    id,
    username,
    email,
    display_name,
    role,
    avatar_url,
    banner_url,
    sport,
    team,
    bio,
    location,
    org_name,
    role_title,
    linkedin_link,
    birthday,
    links
  )
  values (
    new.id,
    coalesce(meta_username, split_part(coalesce(new.email, ''), '@', 1), 'user'),
    coalesce(new.email, ''),
    meta_display_name,
    meta_role,
    meta_avatar_url,
    meta_banner_url,
    meta_sport,
    meta_team,
    meta_bio,
    meta_location,
    meta_org_name,
    meta_role_title,
    meta_linkedin_link,
    meta_birthday,
    meta_links
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = coalesce(nullif(excluded.username, ''), public.profiles.username),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    role = coalesce(excluded.role, public.profiles.role),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    banner_url = coalesce(excluded.banner_url, public.profiles.banner_url),
    sport = coalesce(excluded.sport, public.profiles.sport),
    team = coalesce(excluded.team, public.profiles.team),
    bio = coalesce(excluded.bio, public.profiles.bio),
    location = coalesce(excluded.location, public.profiles.location),
    org_name = coalesce(excluded.org_name, public.profiles.org_name),
    role_title = coalesce(excluded.role_title, public.profiles.role_title),
    linkedin_link = coalesce(excluded.linkedin_link, public.profiles.linkedin_link),
    birthday = coalesce(excluded.birthday, public.profiles.birthday),
    links = coalesce(excluded.links, public.profiles.links);

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function public.sync_profile_from_auth_user();

-- Backfill existing auth users to align profiles with current metadata.
do $$
declare
  u record;
begin
  for u in select id, email, raw_user_meta_data from auth.users loop
    insert into public.profiles (
      id,
      username,
      email,
      display_name,
      role,
      avatar_url,
      banner_url,
      sport,
      team,
      bio,
      location,
      org_name,
      role_title,
      linkedin_link,
      birthday,
      links
    )
    values (
      u.id,
      coalesce(
        nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
        split_part(coalesce(u.email, ''), '@', 1),
        'user'
      ),
      coalesce(u.email, ''),
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'profile_name', u.raw_user_meta_data ->> 'full_name')), ''),
      case
        when lower(coalesce(trim(u.raw_user_meta_data ->> 'role'), '')) in ('athlete', 'fan', 'scout', 'coach')
          then lower(trim(u.raw_user_meta_data ->> 'role'))::public.profile_role
        else null
      end,
      nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'banner_url'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'sport'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'team'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'bio'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'location'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'org_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'role_title'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'linkedin_link'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'birthday'), ''),
      case when jsonb_typeof(u.raw_user_meta_data -> 'links') = 'array' then u.raw_user_meta_data -> 'links' else null end
    )
    on conflict (id) do update
    set
      email = excluded.email,
      username = coalesce(nullif(excluded.username, ''), public.profiles.username),
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      role = coalesce(excluded.role, public.profiles.role),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      banner_url = coalesce(excluded.banner_url, public.profiles.banner_url),
      sport = coalesce(excluded.sport, public.profiles.sport),
      team = coalesce(excluded.team, public.profiles.team),
      bio = coalesce(excluded.bio, public.profiles.bio),
      location = coalesce(excluded.location, public.profiles.location),
      org_name = coalesce(excluded.org_name, public.profiles.org_name),
      role_title = coalesce(excluded.role_title, public.profiles.role_title),
      linkedin_link = coalesce(excluded.linkedin_link, public.profiles.linkedin_link),
      birthday = coalesce(excluded.birthday, public.profiles.birthday),
      links = coalesce(excluded.links, public.profiles.links);
  end loop;
end $$;

