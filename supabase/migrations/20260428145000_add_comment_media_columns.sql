alter table if exists public.comments
  add column if not exists media_url text,
  add column if not exists media_type text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comments'
      and column_name = 'media_type'
  ) then
    alter table public.comments
      drop constraint if exists comments_media_type_check;
    alter table public.comments
      add constraint comments_media_type_check
      check (media_type in ('image', 'video') or media_type is null);
  end if;
end $$;
