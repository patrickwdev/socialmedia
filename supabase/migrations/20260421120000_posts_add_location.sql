-- Optional place label on a post (e.g. from compose flow), shown next to timestamp in the feed.
alter table public.posts
  add column if not exists location text;

comment on column public.posts.location is 'Human-readable place label attached at post time; optional.';
