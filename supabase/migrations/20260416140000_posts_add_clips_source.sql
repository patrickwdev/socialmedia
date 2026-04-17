-- Which profile sub-tab a clip belongs to (Highlights vs Grinds).
alter table public.posts add column if not exists clips_source text;

alter table public.posts drop constraint if exists posts_clips_source_check;
alter table public.posts
  add constraint posts_clips_source_check
  check (clips_source is null or clips_source in ('highlights', 'grinds'));
