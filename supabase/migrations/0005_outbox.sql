-- Transactional outbox for notifications. Rows are enqueued in the same
-- transaction as the booking change, leased with SKIP LOCKED so several cron
-- workers never process the same job, and deduplicated by (tenant, dedupe_key).

create or replace function public.enqueue_notification(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_kind text,
  p_channel text,
  p_scheduled_for timestamptz,
  p_dedupe_key text,
  p_payload jsonb
)
returns void
language sql
as $$
  insert into public.notification_jobs (tenant_id, booking_id, kind, channel, scheduled_for, dedupe_key, payload)
  values (p_tenant_id, p_booking_id, p_kind, p_channel, p_scheduled_for, p_dedupe_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (tenant_id, dedupe_key) do nothing;
$$;

create or replace function public.rpc_claim_notification_jobs(p_limit int, p_lease_seconds int)
returns setof public.notification_jobs
language plpgsql
as $$
begin
  return query
  with due as (
    select j.id
    from public.notification_jobs j
    where j.status in ('pending', 'failed')
      and j.scheduled_for <= now()
      and (j.lease_until is null or j.lease_until < now())
    order by j.scheduled_for
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.notification_jobs j
    set status = 'leased',
        attempts = j.attempts + 1,
        lease_until = now() + make_interval(secs => greatest(p_lease_seconds, 5)),
        updated_at = now()
    from due
    where j.id = due.id
    returning j.*;
end;
$$;

create or replace function public.rpc_finish_notification_job(p_id uuid, p_status text, p_error text)
returns void
language sql
as $$
  update public.notification_jobs
    set status = p_status,
        lease_until = null,
        last_error = p_error,
        updated_at = now()
    where id = p_id;
$$;

create or replace function public.rpc_requeue_stale_notification_jobs()
returns int
language sql
as $$
  with stale as (
    update public.notification_jobs
      set status = 'pending', lease_until = null, updated_at = now()
      where status = 'leased' and lease_until < now() and attempts < 5
      returning 1
  )
  select count(*)::int from stale;
$$;
