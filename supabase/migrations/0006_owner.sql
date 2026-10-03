-- Owner-facing read models and mutations. Statistics are computed in SQL and
-- keep arrivals, completed jobs and received money strictly separate; future
-- bookings are labelled "upcoming" and never counted as revenue.

create or replace function public.rpc_stats(p_tenant_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
as $$
declare
  v_tz text;
  v_currency text;
  v_from timestamptz;
  v_to timestamptz;
  v_arrivals int;
  v_completed int;
  v_cancelled int;
  v_received int;
  v_refunded int;
  v_upcoming int;
begin
  select timezone, currency into v_tz, v_currency from public.tenants where id = p_tenant_id;
  if v_tz is null then raise exception 'tenant_not_found' using errcode = 'P0001'; end if;
  v_from := (p_from::timestamp at time zone v_tz);
  v_to := (p_to::timestamp at time zone v_tz) + interval '1 day';

  select count(*) into v_arrivals from public.bookings
    where tenant_id = p_tenant_id and start_at >= v_from and start_at < v_to
      and status in ('arrived', 'in_progress', 'completed');
  select count(*) into v_completed from public.bookings
    where tenant_id = p_tenant_id and status = 'completed'
      and coalesce(completed_at, start_at) >= v_from and coalesce(completed_at, start_at) < v_to;
  select count(*) into v_cancelled from public.bookings
    where tenant_id = p_tenant_id and status = 'cancelled'
      and coalesce(cancelled_at, start_at) >= v_from and coalesce(cancelled_at, start_at) < v_to;
  select coalesce(sum(amount_minor), 0) into v_received from public.payments
    where tenant_id = p_tenant_id and kind = 'payment' and created_at >= v_from and created_at < v_to;
  select coalesce(sum(amount_minor), 0) into v_refunded from public.payments
    where tenant_id = p_tenant_id and kind = 'refund' and created_at >= v_from and created_at < v_to;
  select coalesce(sum(price_minor), 0) into v_upcoming from public.bookings
    where tenant_id = p_tenant_id and start_at >= now() and status not in ('cancelled', 'completed', 'no_show');

  return jsonb_build_object(
    'from', to_char(p_from, 'YYYY-MM-DD'),
    'to', to_char(p_to, 'YYYY-MM-DD'),
    'timezone', v_tz,
    'arrivals', v_arrivals,
    'completed', v_completed,
    'cancelled', v_cancelled,
    'receivedMinor', v_received,
    'refundedMinor', v_refunded,
    'upcomingMinor', v_upcoming,
    'currency', v_currency
  );
end;
$$;

create or replace function public.rpc_owner_schedule(p_tenant_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
as $$
declare
  v_tz text;
  v_d date;
  v_days jsonb[] := array[]::jsonb[];
  v_bookings jsonb;
begin
  select timezone into v_tz from public.tenants where id = p_tenant_id;
  if v_tz is null then raise exception 'tenant_not_found' using errcode = 'P0001'; end if;
  for v_d in select generate_series(p_from, p_to, interval '1 day')::date loop
    select coalesce(jsonb_agg(public.booking_json(b) order by b.start_at), '[]'::jsonb) into v_bookings
    from public.bookings b
    where b.tenant_id = p_tenant_id
      and b.start_at >= (v_d::timestamp at time zone v_tz)
      and b.start_at < ((v_d::timestamp at time zone v_tz) + interval '1 day');
    v_days := array_append(v_days, jsonb_build_object('date', to_char(v_d, 'YYYY-MM-DD'), 'bookings', v_bookings));
  end loop;
  return jsonb_build_object('timezone', v_tz, 'days', to_jsonb(v_days));
end;
$$;

create or replace function public.rpc_owner_set_status(p_booking_id uuid, p_status text, p_actor text)
returns jsonb
language plpgsql
as $$
declare
  v_booking public.bookings;
begin
  if p_status not in ('pending', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show') then
    raise exception 'bad_status' using errcode = 'P0020';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0010'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_booking.tenant_id::text, 42));

  update public.bookings
    set status = p_status,
        completed_at = case when p_status = 'completed' then now() else completed_at end,
        cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
    where id = p_booking_id
    returning * into v_booking;

  if p_status = 'cancelled' then
    delete from public.resource_occupancies where booking_id = p_booking_id;
    update public.notification_jobs set status = 'cancelled', updated_at = now()
      where booking_id = p_booking_id and status in ('pending', 'leased');
  end if;

  insert into public.booking_events (tenant_id, booking_id, type, actor, payload)
  values (v_booking.tenant_id, v_booking.id, 'status:' || p_status, coalesce(p_actor, 'owner'), '{}'::jsonb);

  return public.booking_json(v_booking);
end;
$$;

create or replace function public.rpc_owner_add_payment(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_amount_minor int,
  p_kind text,
  p_method text,
  p_idempotency_key text,
  p_demo boolean
)
returns jsonb
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_kind not in ('payment', 'refund') then raise exception 'bad_payment_kind' using errcode = 'P0021'; end if;
  if p_amount_minor <= 0 then raise exception 'bad_amount' using errcode = 'P0022'; end if;
  insert into public.payments (tenant_id, booking_id, amount_minor, kind, method, idempotency_key, demo)
  values (p_tenant_id, p_booking_id, p_amount_minor, p_kind, coalesce(p_method, 'card'), p_idempotency_key, coalesce(p_demo, false))
  on conflict (tenant_id, idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.payments where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  end if;
  return jsonb_build_object('id', v_id, 'replayed', v_id is null);
end;
$$;

create or replace function public.rpc_owner_upsert_service(p_tenant_id uuid, p_service jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_id uuid;
  v_row public.services;
begin
  v_id := nullif(p_service ->> 'id', '')::uuid;
  if v_id is null then
    insert into public.services (tenant_id, name, description, price_minor, duration_minutes,
      buffer_before_minutes, buffer_after_minutes, resource_kind, is_active, sort)
    values (p_tenant_id,
      coalesce(p_service ->> 'name', 'Услуга'),
      p_service ->> 'description',
      coalesce((p_service ->> 'priceMinor')::int, 0),
      coalesce((p_service ->> 'durationMinutes')::int, 60),
      coalesce((p_service ->> 'bufferBeforeMinutes')::int, 0),
      coalesce((p_service ->> 'bufferAfterMinutes')::int, 0),
      p_service ->> 'resourceKind',
      coalesce((p_service ->> 'isActive')::boolean, true),
      coalesce((p_service ->> 'sort')::int, 0))
    returning * into v_row;
  else
    update public.services set
      name = coalesce(p_service ->> 'name', name),
      description = coalesce(p_service ->> 'description', description),
      price_minor = coalesce((p_service ->> 'priceMinor')::int, price_minor),
      duration_minutes = coalesce((p_service ->> 'durationMinutes')::int, duration_minutes),
      buffer_before_minutes = coalesce((p_service ->> 'bufferBeforeMinutes')::int, buffer_before_minutes),
      buffer_after_minutes = coalesce((p_service ->> 'bufferAfterMinutes')::int, buffer_after_minutes),
      resource_kind = coalesce(p_service ->> 'resourceKind', resource_kind),
      is_active = coalesce((p_service ->> 'isActive')::boolean, is_active),
      sort = coalesce((p_service ->> 'sort')::int, sort),
      updated_at = now()
    where id = v_id and tenant_id = p_tenant_id
    returning * into v_row;
    if not found then raise exception 'service_not_found' using errcode = 'P0002'; end if;
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.rpc_owner_delete_service(p_tenant_id uuid, p_id uuid)
returns void
language sql
as $$
  delete from public.services where id = p_id and tenant_id = p_tenant_id
    and not exists (select 1 from public.bookings b where b.service_id = p_id);
$$;

create or replace function public.rpc_owner_hours(p_tenant_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object('weekday', weekday, 'windows', windows) order by weekday), '[]'::jsonb)
  from (
    select weekday, jsonb_agg(jsonb_build_object('startMin', start_min, 'endMin', end_min) order by start_min) as windows
    from public.working_hours
    where tenant_id = p_tenant_id
    group by weekday
  ) grouped;
$$;

create or replace function public.rpc_owner_set_hours(p_tenant_id uuid, p_hours jsonb)
returns void
language plpgsql
as $$
begin
  if jsonb_typeof(p_hours) is distinct from 'array' then
    raise exception 'hours_must_be_array' using errcode = 'P0023';
  end if;
  delete from public.working_hours where tenant_id = p_tenant_id;
  insert into public.working_hours (tenant_id, weekday, start_min, end_min)
  select p_tenant_id,
         (day ->> 'weekday')::int,
         (win ->> 'startMin')::int,
         (win ->> 'endMin')::int
  from jsonb_array_elements(p_hours) as day
  cross join lateral jsonb_array_elements(coalesce(day -> 'windows', '[]'::jsonb)) as win
  where (win ->> 'endMin')::int > (win ->> 'startMin')::int;
end;
$$;

create or replace function public.rpc_owner_upsert_media(p_tenant_id uuid, p_work jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_id uuid;
  v_row public.media;
begin
  v_id := nullif(p_work ->> 'id', '')::uuid;
  if v_id is null then
    insert into public.media (tenant_id, kind, storage_path, image_url, caption, sort, is_owner_uploaded)
    values (p_tenant_id, 'work', p_work ->> 'storagePath', p_work ->> 'imageUrl',
            p_work ->> 'caption', coalesce((p_work ->> 'sort')::int, 0), true)
    returning * into v_row;
  else
    update public.media set
      storage_path = coalesce(p_work ->> 'storagePath', storage_path),
      image_url = coalesce(p_work ->> 'imageUrl', image_url),
      caption = coalesce(p_work ->> 'caption', caption),
      sort = coalesce((p_work ->> 'sort')::int, sort)
    where id = v_id and tenant_id = p_tenant_id
    returning * into v_row;
    if not found then raise exception 'media_not_found' using errcode = 'P0024'; end if;
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.rpc_owner_delete_media(p_tenant_id uuid, p_id uuid)
returns void
language sql
as $$
  delete from public.media where id = p_id and tenant_id = p_tenant_id;
$$;

create or replace function public.rpc_owner_update_tenant(p_tenant_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_row public.tenants;
begin
  update public.tenants set
    name = coalesce(p_patch ->> 'name', name),
    tagline = coalesce(p_patch ->> 'tagline', tagline),
    description = coalesce(p_patch ->> 'description', description),
    accent = coalesce(p_patch ->> 'accent', accent),
    timezone = coalesce(p_patch ->> 'timezone', timezone),
    currency = coalesce(p_patch ->> 'currency', currency),
    phone = coalesce(p_patch ->> 'phone', phone),
    address = coalesce(p_patch ->> 'address', address),
    map_url = coalesce(p_patch ->> 'mapUrl', map_url),
    hero_image_url = coalesce(p_patch ->> 'heroImageUrl', hero_image_url),
    logo_url = coalesce(p_patch ->> 'logoUrl', logo_url),
    booking_lead_minutes = coalesce((p_patch ->> 'bookingLeadMinutes')::int, booking_lead_minutes),
    cancel_window_minutes = coalesce((p_patch ->> 'cancelWindowMinutes')::int, cancel_window_minutes),
    slot_step_minutes = coalesce((p_patch ->> 'slotStepMinutes')::int, slot_step_minutes)
  where id = p_tenant_id
  returning * into v_row;
  if not found then raise exception 'tenant_not_found' using errcode = 'P0001'; end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.rpc_owner_jobs(p_tenant_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'bookingId', booking_id, 'kind', kind, 'channel', channel,
    'scheduledFor', scheduled_for, 'status', status, 'attempts', attempts) order by scheduled_for desc), '[]'::jsonb)
  from public.notification_jobs
  where tenant_id = p_tenant_id
  limit 100;
$$;
