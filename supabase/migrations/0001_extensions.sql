-- Extensions required by the booking core.
-- pgcrypto: hmac()/digest() for booking access tokens and hashes.
-- btree_gist: equality operators on uuid so resource_occupancies can use a
--             GiST EXCLUDE constraint over (tenant_id, resource_id, tstzrange).
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- Resolve the current authenticated user id without depending on the auth
-- schema, so the same policies and tests run on plain Postgres.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
