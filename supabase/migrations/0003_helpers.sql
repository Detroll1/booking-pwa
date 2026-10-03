-- Shared helpers: timestamps, membership, tokens, working-window validation,
-- atomic rate limits and the LLM budget counter.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = public.current_user_id()
  );
$$;

-- Deterministic cryptographic access token. Because it is derived from the
-- booking id and a server-only secret, a retried request re-issues the exact
-- same access without ever storing the raw token.
create or replace function public.booking_access_token(p_tenant_id uuid, p_booking_id uuid, p_secret text)
returns text
language sql
immutable
as $$
  select encode(hmac(p_tenant_id::text || ':' || p_booking_id::text, p_secret, 'sha256'), 'hex');
$$;

create or replace function public.booking_token_hash(p_token text)
returns text
language sql
immutable
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

-- True when the instant falls inside a working window for the tenant timezone
-- and is not on a closed exception date.
create or replace function public.is_appointment_start(p_tenant_id uuid, p_ts timestamptz)
returns boolean
language plpgsql
stable
as $$
declare
  v_tz text;
  v_local timestamp;
  v_minute int;
  v_weekday int;
begin
  select timezone into v_tz from public.tenants where id = p_tenant_id;
  if v_tz is null then
    return false;
  end if;
  v_local := p_ts at time zone v_tz;
  v_minute := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  v_weekday := extract(dow from v_local)::int;

  if exists (
    select 1 from public.schedule_exceptions e
    where e.tenant_id = p_tenant_id
      and e.date = v_local::date
      and e.is_closed
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.schedule_exceptions e
    where e.tenant_id = p_tenant_id
      and e.date = v_local::date
      and not e.is_closed
  ) then
    return exists (
      select 1 from public.schedule_exceptions e
      where e.tenant_id = p_tenant_id
        and e.date = v_local::date
        and not e.is_closed
        and v_minute >= coalesce(e.start_min, 0)
        and v_minute < coalesce(e.end_min, 1440)
    );
  end if;

  return exists (
    select 1 from public.working_hours wh
    where wh.tenant_id = p_tenant_id
      and wh.weekday = v_weekday
      and v_minute >= wh.start_min
      and v_minute < wh.end_min
  );
end;
$$;

-- Fixed-window counter used to limit public requests and LLM spend. The upsert
-- is a single atomic statement, so concurrent callers cannot exceed the budget.
create or replace function public.rpc_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (key, window_start, window_seconds, count)
  values (p_key, now(), p_window_seconds, 1)
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start + make_interval(secs => public.rate_limits.window_seconds) < now() then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start + make_interval(secs => public.rate_limits.window_seconds) < now() then now()
          else public.rate_limits.window_start
        end,
        window_seconds = p_window_seconds,
        updated_at = now()
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

create or replace function public.rpc_llm_consume(p_tenant_id uuid, p_prompt_tokens int, p_completion_tokens int, p_daily_limit int)
returns boolean
language plpgsql
as $$
declare
  v_allowed boolean;
begin
  insert into public.llm_usage (tenant_id, day, requests, prompt_tokens, completion_tokens)
  values (p_tenant_id, (now() at time zone 'UTC')::date, 1, p_prompt_tokens, p_completion_tokens)
  on conflict (tenant_id, day) do update
    set requests = public.llm_usage.requests + 1,
        prompt_tokens = public.llm_usage.prompt_tokens + p_prompt_tokens,
        completion_tokens = public.llm_usage.completion_tokens + p_completion_tokens
  returning (public.llm_usage.requests <= p_daily_limit) into v_allowed;
  return coalesce(v_allowed, false);
end;
$$;
