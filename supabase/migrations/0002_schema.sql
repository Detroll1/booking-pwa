-- Core multi-tenant schema. Every dependent row carries tenant_id, and child
-- tables reference (tenant_id, id) composite keys so a row can never point at
-- another tenant's data.

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  description text,
  accent text,
  timezone text not null default 'UTC',
  currency text not null default 'RUB',
  locale text not null default 'ru-RU',
  status text not null default 'preview' check (status in ('preview', 'live')),
  phone text,
  address text,
  map_url text,
  hero_image_url text,
  logo_url text,
  social jsonb not null default '{}'::jsonb,
  booking_lead_minutes int not null default 0 check (booking_lead_minutes >= 0),
  cancel_window_minutes int not null default 0 check (cancel_window_minutes >= 0),
  slot_step_minutes int not null default 30 check (slot_step_minutes between 5 and 240),
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  kind text not null default 'bay',
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  price_minor int not null check (price_minor >= 0),
  duration_minutes int not null check (duration_minutes between 5 and 43200),
  buffer_before_minutes int not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes >= 0),
  resource_kind text,
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min between 1 and 1440),
  check (end_min > start_min),
  unique (tenant_id, weekday, start_min)
);

create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date date not null,
  is_closed boolean not null default true,
  start_min int,
  end_min int,
  note text,
  unique (tenant_id, date)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null,
  resource_id uuid,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show')),
  customer_name text not null,
  customer_phone text not null,
  customer_car text,
  customer_comment text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes int not null,
  buffer_before_minutes int not null default 0,
  buffer_after_minutes int not null default 0,
  price_minor int not null,
  currency text not null,
  service_name text not null,
  token_hash text,
  source text not null default 'client' check (source in ('client', 'owner', 'ai')),
  idempotency_key text,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  check (end_at > start_at),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, service_id) references public.services(tenant_id, id),
  foreign key (tenant_id, resource_id) references public.resources(tenant_id, id)
);

-- One table holds both bookings and manual resource blocks; the GiST EXCLUDE
-- constraint makes double-booking impossible at the database level.
create table if not exists public.resource_occupancies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  resource_id uuid not null,
  booking_id uuid,
  kind text not null default 'booking' check (kind in ('booking', 'block', 'closure')),
  during tstzrange not null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, resource_id) references public.resources(tenant_id, id) on delete cascade,
  foreign key (tenant_id, booking_id) references public.bookings(tenant_id, id) on delete cascade,
  constraint resource_occupancies_no_overlap
    exclude using gist (tenant_id with =, resource_id with =, during with &&)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid,
  amount_minor int not null check (amount_minor > 0),
  kind text not null check (kind in ('payment', 'refund')),
  method text not null default 'card',
  idempotency_key text,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, booking_id) references public.bookings(tenant_id, id) on delete set null,
  unique (tenant_id, idempotency_key)
);

create table if not exists public.booking_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor text not null default 'system',
  created_at timestamptz not null default now(),
  foreign key (tenant_id, booking_id) references public.bookings(tenant_id, id) on delete cascade
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid,
  endpoint text not null,
  keys jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, booking_id) references public.bookings(tenant_id, id) on delete cascade,
  unique (endpoint)
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null,
  kind text not null,
  channel text not null default 'push' check (channel in ('push', 'email')),
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'sent', 'failed', 'cancelled', 'skipped')),
  attempts int not null default 0,
  lease_until timestamptz,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, booking_id) references public.bookings(tenant_id, id) on delete cascade,
  unique (tenant_id, dedupe_key)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null default 'work' check (kind in ('hero', 'logo', 'work', 'icon')),
  storage_path text,
  image_url text,
  caption text,
  sort int not null default 0,
  is_owner_uploaded boolean not null default false,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table if not exists public.info_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  body text not null,
  icon text,
  sort int not null default 0
);

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  window_seconds int not null,
  count int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.llm_usage (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  day date not null,
  requests int not null default 0,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  primary key (tenant_id, day)
);

create index if not exists bookings_tenant_start_idx on public.bookings (tenant_id, start_at);
create index if not exists bookings_tenant_status_idx on public.bookings (tenant_id, status);
create index if not exists bookings_token_hash_idx on public.bookings (token_hash);
create index if not exists occupancies_tenant_idx on public.resource_occupancies (tenant_id, resource_id);
create index if not exists services_tenant_idx on public.services (tenant_id, is_active, sort);
create index if not exists media_tenant_idx on public.media (tenant_id, kind, sort);
create index if not exists notification_due_idx on public.notification_jobs (status, scheduled_for);
