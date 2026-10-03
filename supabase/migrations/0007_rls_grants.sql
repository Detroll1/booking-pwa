-- Strict access control. Anonymous clients see nothing directly; the public
-- catalog is served through Edge Functions using the service role. Authenticated
-- owners may read only rows of tenants they are a member of (defense in depth).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.resources enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.bookings enable row level security;
alter table public.resource_occupancies enable row level security;
alter table public.payments enable row level security;
alter table public.booking_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.media enable row level security;
alter table public.info_cards enable row level security;
alter table public.rate_limits enable row level security;
alter table public.llm_usage enable row level security;

-- Owner reads. No anon policies exist, so anon is denied everything.
drop policy if exists tenants_member_select on public.tenants;
create policy tenants_member_select on public.tenants
  for select to authenticated using (public.is_tenant_member(id));

drop policy if exists memberships_self_select on public.tenant_memberships;
create policy memberships_self_select on public.tenant_memberships
  for select to authenticated using (user_id = public.current_user_id());

do $$
declare
  t text;
begin
  foreach t in array array[
    'resources', 'services', 'working_hours', 'schedule_exceptions', 'bookings',
    'resource_occupancies', 'payments', 'booking_events', 'push_subscriptions',
    'notification_jobs', 'media', 'info_cards'
  ]
  loop
    execute format('drop policy if exists %I_member_select on public.%I', t, t);
    execute format(
      'create policy %I_member_select on public.%I for select to authenticated using (public.is_tenant_member(tenant_id))',
      t, t
    );
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.tenants, public.tenant_memberships, public.resources, public.services,
  public.working_hours, public.schedule_exceptions, public.bookings, public.resource_occupancies,
  public.payments, public.booking_events, public.push_subscriptions, public.notification_jobs,
  public.media, public.info_cards to authenticated;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
-- RLS policies evaluate these helpers as the calling role.
grant execute on function public.current_user_id() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
