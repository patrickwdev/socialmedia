-- Coach "Clips" chip posts use clips_source = 'clips'; extend check constraint.
alter table public.posts drop constraint if exists posts_clips_source_check;
alter table public.posts
  add constraint posts_clips_source_check
  check (clips_source is null or clips_source in ('highlights', 'grinds', 'clips'));
