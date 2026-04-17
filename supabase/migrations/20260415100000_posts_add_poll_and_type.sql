-- Poll payload + allow post.type = 'poll'. Safe to re-run.

alter table public.posts add column if not exists poll jsonb;

-- Drop constraint added by a previous run of this migration.
alter table public.posts drop constraint if exists posts_type_check;

-- Drop the original CREATE TABLE check on `type` (Postgres usually stores it as
-- `(type = ANY (ARRAY[...]))`, so a naive `... ilike '%in (%video%'` often misses it).
-- Target single-column CHECK constraints on column `type` that do not already allow poll.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'posts'
      and c.contype = 'c'
      and c.conkey is not null
      and cardinality(c.conkey) = 1
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attnum = c.conkey[1]
          and a.attname = 'type'
      )
      and pg_get_constraintdef(c.oid) not ilike '%poll%'
  loop
    execute format('alter table public.posts drop constraint %I', r.conname);
  end loop;
end
$$;

alter table public.posts
  add constraint posts_type_check
  check (type in ('video', 'image', 'text', 'poll'));
