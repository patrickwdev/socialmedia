-- Add dedicated post_type for clips/reels while keeping shared posts table.
alter table public.posts add column if not exists post_type text not null default 'post';

alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts
  add constraint posts_post_type_check
  check (post_type in ('post', 'clips'));
