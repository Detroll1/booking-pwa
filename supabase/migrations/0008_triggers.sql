create or replace trigger tenants_touch
  before update on public.tenants
  for each row execute function public.touch_updated_at();

create or replace trigger services_touch
  before update on public.services
  for each row execute function public.touch_updated_at();

create or replace trigger bookings_touch
  before update on public.bookings
  for each row execute function public.touch_updated_at();

create or replace trigger notification_jobs_touch
  before update on public.notification_jobs
  for each row execute function public.touch_updated_at();
