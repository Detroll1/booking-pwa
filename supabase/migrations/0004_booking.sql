-- Availability and the atomic booking lifecycle. All mutations happen inside a
-- single SQL function (one transaction): a failed move rolls back and the
-- original booking survives; a concurrent grab of the same resource fails on
-- the GiST EXCLUDE constraint.

create or replace function public.booking_json(p_booking public.bookings)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', b.id,
    'tenantSlug', t.slug,
    'status', b.status,
    'serviceName', b.service_name,
    'customerName', b.customer_name,
    'customerPhone', b.customer_phone,
    'car', b.customer_car,
    'comment', b.customer_comment,
    'startAt', b.start_at,
    'endAt', b.end_at,
    'durationMinutes', b.duration_minutes,
    'priceMinor', b.price_minor,
    'currency', b.currency,
    'timezone', t.timezone,
    'address', t.address,
    'phone', t.phone,
    'resourceName', r.name,
    'canCancel', b.status not in ('cancelled', 'completed', 'no_show')
      and (b.start_at - make_interval(mins => t.cancel_window_minutes)) > now()
  )
  from public.bookings b
  join public.tenants t on t.id = b.tenant_id
  left join public.resources r on r.id = b.resource_id
  where b.id = p_booking.id;
$$;

create or replace function public.rpc_get_availability(
  p_tenant_id uuid,
  p_service_id uuid,
  p_from date,
  p_days int default 14
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_tz text;
  v_step int;
  v_lead int;
  v_duration int;
  v_bb int;
  v_ba int;
  v_duration_kind text;
  v_kind text;
  v_i int;
  v_d date;
  v_local record;
  v_exc record;
  v_win record;
  v_min int;
  v_total int;
  v_closed boolean;
  v_ts timestamptz;
  v_occ tstzrange;
  v_free boolean;
  v_slots jsonb;
  v_day jsonb;
  v_days jsonb[] := array[]::jsonb[];
begin
  select timezone, slot_step_minutes, booking_lead_minutes into v_tz, v_step, v_lead
    from public.tenants where id = p_tenant_id;
  if v_tz is null then
    raise exception 'tenant_not_found' using errcode = 'P0001';
  end if;
  select duration_minutes, buffer_before_minutes, buffer_after_minutes, resource_kind
    into v_duration, v_bb, v_ba, v_kind
    from public.services where id = p_service_id and tenant_id = p_tenant_id and is_active;
  if not found then
    raise exception 'service_not_available' using errcode = 'P0002';
  end if;
  v_duration_kind := v_kind;

  for v_i in 0 .. (greatest(p_days, 1) - 1) loop
    v_d := p_from + v_i;
    v_slots := '[]'::jsonb;
    v_closed := false;

    select * into v_exc from public.schedule_exceptions se
      where se.tenant_id = p_tenant_id and se.date = v_d;

    if found then
      if v_exc.is_closed then
        v_closed := true;
      else
        v_total := coalesce(v_exc.end_min, 1440) - coalesce(v_exc.start_min, 0);
        v_min := (ceil(coalesce(v_exc.start_min, 0)::numeric / v_step) * v_step)::int;
        while v_min < coalesce(v_exc.end_min, 0) loop
          if (v_min + v_duration <= coalesce(v_exc.end_min, 0)) or (v_duration > v_total) then
            v_ts := ((v_d + make_interval(mins => v_min))::timestamp at time zone v_tz);
            if v_ts >= now() + make_interval(mins => v_lead) then
              v_occ := tstzrange(v_ts - make_interval(mins => v_bb), v_ts + make_interval(mins => v_duration + v_ba), '[)');
              v_free := exists (
                select 1 from public.resources r
                where r.tenant_id = p_tenant_id and r.is_active
                  and (v_duration_kind is null or r.kind = v_duration_kind)
                  and not exists (
                    select 1 from public.resource_occupancies o
                    where o.tenant_id = p_tenant_id and o.resource_id = r.id and o.during && v_occ
                  )
              );
              if v_free then v_slots := v_slots || to_jsonb(v_ts); end if;
            end if;
          end if;
          v_min := v_min + v_step;
        end loop;
      end if;
    else
      v_closed := not exists (
        select 1 from public.working_hours wh
        where wh.tenant_id = p_tenant_id and wh.weekday = extract(dow from v_d)::int
      );
      select coalesce(sum(end_min - start_min), 0) into v_total
        from public.working_hours wh
        where wh.tenant_id = p_tenant_id and wh.weekday = extract(dow from v_d)::int;
      for v_win in
        select start_min, end_min from public.working_hours wh
        where wh.tenant_id = p_tenant_id and wh.weekday = extract(dow from v_d)::int
        order by start_min
      loop
        v_min := (ceil(v_win.start_min::numeric / v_step) * v_step)::int;
        while v_min < v_win.end_min loop
          if (v_min + v_duration <= v_win.end_min) or (v_duration > v_total) then
            v_ts := ((v_d + make_interval(mins => v_min))::timestamp at time zone v_tz);
            if v_ts >= now() + make_interval(mins => v_lead) then
              v_occ := tstzrange(v_ts - make_interval(mins => v_bb), v_ts + make_interval(mins => v_duration + v_ba), '[)');
              v_free := exists (
                select 1 from public.resources r
                where r.tenant_id = p_tenant_id and r.is_active
                  and (v_duration_kind is null or r.kind = v_duration_kind)
                  and not exists (
                    select 1 from public.resource_occupancies o
                    where o.tenant_id = p_tenant_id and o.resource_id = r.id and o.during && v_occ
                  )
              );
              if v_free then v_slots := v_slots || to_jsonb(v_ts); end if;
            end if;
          end if;
          v_min := v_min + v_step;
        end loop;
      end loop;
    end if;

    v_day := jsonb_build_object('date', to_char(v_d, 'YYYY-MM-DD'), 'isClosed', v_closed, 'slots', v_slots);
    v_days := array_append(v_days, v_day);
  end loop;

  return jsonb_build_object(
    'timezone', v_tz,
    'serviceId', p_service_id,
    'durationMinutes', v_duration,
    'days', to_jsonb(v_days)
  );
end;
$$;

create or replace function public.rpc_create_booking(
  p_tenant_id uuid,
  p_service_id uuid,
  p_start timestamptz,
  p_customer jsonb,
  p_idempotency_key text,
  p_source text,
  p_secret text,
  p_demo boolean
)
returns jsonb
language plpgsql
as $$
declare
  v_tenant public.tenants;
  v_service public.services;
  v_booking public.bookings;
  v_res public.resources;
  v_cand public.resources;
  v_token text;
  v_end timestamptz;
  v_occ tstzrange;
  v_name text;
  v_phone text;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id;
  if not found then raise exception 'tenant_not_found' using errcode = 'P0001'; end if;

  -- Serialize occupancy mutations per tenant. Without this, two concurrent
  -- inserts that both try the same resource can deadlock on the GiST EXCLUDE
  -- index before either can fall through to the next free resource.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 42));

  if p_idempotency_key is not null then
    select * into v_booking from public.bookings
      where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    if found then
      v_token := public.booking_access_token(p_tenant_id, v_booking.id, p_secret);
      return jsonb_build_object('booking', public.booking_json(v_booking), 'accessToken', v_token, 'replayed', true);
    end if;
  end if;

  select * into v_service from public.services
    where id = p_service_id and tenant_id = p_tenant_id and is_active;
  if not found then raise exception 'service_not_available' using errcode = 'P0002'; end if;

  if coalesce(p_source, 'client') = 'client'
     and p_start < now() + make_interval(mins => v_tenant.booking_lead_minutes) then
    raise exception 'too_soon' using errcode = 'P0003';
  end if;

  if not public.is_appointment_start(p_tenant_id, p_start) then
    raise exception 'outside_working_hours' using errcode = 'P0004';
  end if;

  v_name := nullif(trim(p_customer ->> 'name'), '');
  v_phone := nullif(trim(p_customer ->> 'phone'), '');
  if v_name is null or v_phone is null then
    raise exception 'customer_required' using errcode = 'P0005';
  end if;

  v_end := p_start + make_interval(mins => v_service.duration_minutes);
  v_occ := tstzrange(
    p_start - make_interval(mins => v_service.buffer_before_minutes),
    v_end + make_interval(mins => v_service.buffer_after_minutes),
    '[)'
  );

  begin
    insert into public.bookings (
      tenant_id, service_id, status, customer_name, customer_phone, customer_car, customer_comment,
      start_at, end_at, duration_minutes, buffer_before_minutes, buffer_after_minutes,
      price_minor, currency, service_name, source, idempotency_key, demo
    ) values (
      p_tenant_id, v_service.id, 'confirmed', v_name, v_phone,
      nullif(trim(p_customer ->> 'car'), ''), nullif(trim(p_customer ->> 'comment'), ''),
      p_start, v_end, v_service.duration_minutes, v_service.buffer_before_minutes, v_service.buffer_after_minutes,
      v_service.price_minor, v_tenant.currency, v_service.name,
      coalesce(p_source, 'client'), p_idempotency_key, coalesce(p_demo, false)
    )
    returning * into v_booking;
  exception when unique_violation then
    select * into v_booking from public.bookings
      where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    if found then
      v_token := public.booking_access_token(p_tenant_id, v_booking.id, p_secret);
      return jsonb_build_object('booking', public.booking_json(v_booking), 'accessToken', v_token, 'replayed', true);
    end if;
    raise;
  end;

  for v_cand in
    select * from public.resources r
    where r.tenant_id = p_tenant_id and r.is_active
      and (v_service.resource_kind is null or r.kind = v_service.resource_kind)
    order by r.sort, r.id
  loop
    begin
      insert into public.resource_occupancies (tenant_id, resource_id, booking_id, kind, during)
      values (p_tenant_id, v_cand.id, v_booking.id, 'booking', v_occ);
      v_res := v_cand;
      exit;
    exception when exclusion_violation then
      continue;
    end;
  end loop;

  if v_res.id is null then
    raise exception 'no_resource_available' using errcode = 'P0006';
  end if;

  update public.bookings set resource_id = v_res.id where id = v_booking.id returning * into v_booking;

  v_token := public.booking_access_token(p_tenant_id, v_booking.id, p_secret);
  update public.bookings set token_hash = public.booking_token_hash(v_token) where id = v_booking.id;

  insert into public.booking_events (tenant_id, booking_id, type, actor, payload)
  values (p_tenant_id, v_booking.id, 'created', coalesce(p_source, 'client'),
          jsonb_build_object('startAt', p_start, 'resourceId', v_res.id));

  perform public.enqueue_notification(p_tenant_id, v_booking.id, 'booking_confirmed', 'push', now(),
          'confirmed:' || v_booking.id::text, '{}'::jsonb);
  perform public.enqueue_notification(p_tenant_id, v_booking.id, 'reminder_24h', 'push',
          v_booking.start_at - interval '24 hours', 'reminder:' || v_booking.id::text, '{}'::jsonb);

  return jsonb_build_object('booking', public.booking_json(v_booking), 'accessToken', v_token, 'replayed', false);
end;
$$;

create or replace function public.rpc_reschedule_booking(
  p_booking_id uuid,
  p_new_start timestamptz,
  p_actor text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
as $$
declare
  v_booking public.bookings;
  v_service public.services;
  v_res public.resources;
  v_cand public.resources;
  v_end timestamptz;
  v_occ tstzrange;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0010'; end if;
  if v_booking.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'booking_not_active' using errcode = 'P0011';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_booking.tenant_id::text, 42));

  if p_idempotency_key is not null and exists (
    select 1 from public.booking_events e
    where e.booking_id = v_booking.id and e.type = 'moved'
      and e.payload ->> 'idempotencyKey' = p_idempotency_key
  ) then
    return jsonb_build_object('booking', public.booking_json(v_booking), 'replayed', true);
  end if;

  if not public.is_appointment_start(v_booking.tenant_id, p_new_start) then
    raise exception 'outside_working_hours' using errcode = 'P0004';
  end if;

  select * into v_service from public.services where id = v_booking.service_id;
  v_end := p_new_start + make_interval(mins => v_service.duration_minutes);
  v_occ := tstzrange(
    p_new_start - make_interval(mins => v_service.buffer_before_minutes),
    v_end + make_interval(mins => v_service.buffer_after_minutes),
    '[)'
  );

  -- Remove the old occupancy. If no new slot can be taken the exception
  -- rolls this delete back, so a failed move never loses the original booking.
  delete from public.resource_occupancies where booking_id = v_booking.id and kind = 'booking';

  for v_cand in
    select * from public.resources r
    where r.tenant_id = v_booking.tenant_id and r.is_active
      and (v_service.resource_kind is null or r.kind = v_service.resource_kind)
    order by (r.id = v_booking.resource_id) desc, r.sort, r.id
  loop
    begin
      insert into public.resource_occupancies (tenant_id, resource_id, booking_id, kind, during)
      values (v_booking.tenant_id, v_cand.id, v_booking.id, 'booking', v_occ);
      v_res := v_cand;
      exit;
    exception when exclusion_violation then
      continue;
    end;
  end loop;

  if v_res.id is null then
    raise exception 'no_resource_available' using errcode = 'P0006';
  end if;

  update public.bookings
    set start_at = p_new_start, end_at = v_end, resource_id = v_res.id
    where id = v_booking.id
    returning * into v_booking;

  insert into public.booking_events (tenant_id, booking_id, type, actor, payload)
  values (v_booking.tenant_id, v_booking.id, 'moved', coalesce(p_actor, 'owner'),
          jsonb_build_object('startAt', p_new_start, 'idempotencyKey', p_idempotency_key));

  -- Rescheduling invalidates the previous reminder and its confirmation.
  update public.notification_jobs set status = 'cancelled', updated_at = now()
    where booking_id = v_booking.id and status = 'pending';
  perform public.enqueue_notification(v_booking.tenant_id, v_booking.id, 'booking_moved', 'push', now(),
          'moved:' || v_booking.id::text || ':' || extract(epoch from p_new_start)::text, '{}'::jsonb);
  perform public.enqueue_notification(v_booking.tenant_id, v_booking.id, 'reminder_24h', 'push',
          v_booking.start_at - interval '24 hours', 'reminder:' || v_booking.id::text || ':' || extract(epoch from p_new_start)::text, '{}'::jsonb);

  return jsonb_build_object('booking', public.booking_json(v_booking), 'replayed', false);
end;
$$;

create or replace function public.rpc_cancel_booking(
  p_booking_id uuid,
  p_actor text,
  p_reason text
)
returns jsonb
language plpgsql
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0010'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_booking.tenant_id::text, 42));
  if v_booking.status = 'cancelled' then
    return jsonb_build_object('booking', public.booking_json(v_booking), 'replayed', true);
  end if;

  update public.bookings
    set status = 'cancelled', cancelled_at = now()
    where id = v_booking.id
    returning * into v_booking;

  delete from public.resource_occupancies where booking_id = v_booking.id;

  insert into public.booking_events (tenant_id, booking_id, type, actor, payload)
  values (v_booking.tenant_id, v_booking.id, 'cancelled', coalesce(p_actor, 'client'),
          jsonb_build_object('reason', p_reason));

  update public.notification_jobs set status = 'cancelled', updated_at = now()
    where booking_id = v_booking.id and status in ('pending', 'leased');
  perform public.enqueue_notification(v_booking.tenant_id, v_booking.id, 'booking_cancelled', 'push', now(),
          'cancelled:' || v_booking.id::text, '{}'::jsonb);

  return jsonb_build_object('booking', public.booking_json(v_booking), 'replayed', false);
end;
$$;

create or replace function public.rpc_block_resource(
  p_tenant_id uuid,
  p_resource_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_note text
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 42));
  insert into public.resource_occupancies (tenant_id, resource_id, kind, during, note)
  values (p_tenant_id, p_resource_id, 'block', tstzrange(p_start, p_end, '[)'), p_note)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.rpc_find_booking_by_token(p_token_hash text)
returns jsonb
language sql
stable
as $$
  select public.booking_json(b)
  from public.bookings b
  where b.token_hash = p_token_hash
  limit 1;
$$;
