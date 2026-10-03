-- Storage bucket for owner-uploaded photos. Guarded so the migration also runs
-- on a plain Postgres used by the SQL tests (where the storage schema is absent).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('tenant-media', 'tenant-media', true)
    on conflict (id) do nothing;
  end if;
end $$;
