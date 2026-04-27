-- Retention policy: remove old notifications after 90 days.
create or replace function public.prune_old_notifications(
  p_retention interval default interval '90 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer := 0;
begin
  delete from public.notifications
  where updated_at < now() - p_retention;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

grant execute on function public.prune_old_notifications(interval) to service_role;

-- Schedule daily cleanup at 03:15 UTC when pg_cron is available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'notifications-retention-daily') then
      perform cron.unschedule('notifications-retention-daily');
    end if;

    perform cron.schedule(
      'notifications-retention-daily',
      '15 3 * * *',
      $cron$select public.prune_old_notifications(interval '90 days');$cron$
    );
  end if;
exception
  when undefined_table then
    -- pg_cron metadata table is unavailable in this environment.
    null;
  when undefined_function then
    -- pg_cron scheduling functions are unavailable.
    null;
end;
$$;
