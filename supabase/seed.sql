-- Demo data. Two clearly different tenants exercise multi-tenant isolation and
-- the "redress in minutes" pipeline. All rows are demo=true; preview tenants
-- never send real notifications. Fixed ids let the SQL tests reference rows.

-- ============================ GRAPHITE Detailing ============================
insert into public.tenants (
  id, slug, name, tagline, description, accent, timezone, currency, locale, status, demo,
  phone, address, map_url, hero_image_url, logo_url,
  booking_lead_minutes, cancel_window_minutes, slot_step_minutes, published_at
) values (
  '11111111-1111-1111-1111-111111111111', 'graphite-detailing', 'GRAPHITE Detailing',
  'Детейлинг-студия полного цикла',
  'Глубокая мойка, полировка и защитные покрытия. Работаем с кузовом, салоном и дисками. Занимаем бокс на всё время услуги — вы не ждёте очереди.',
  '#4690ff', 'Europe/Moscow', 'RUB', 'ru-RU', 'live', true,
  '+7 495 000-10-10', 'Москва, ул. Автозаводская, 18, бокс 4', 'https://yandex.ru/maps/',
  'https://picsum.photos/seed/graphite-hero/1600/900',
  'https://picsum.photos/seed/graphite-logo/128/128',
  60, 180, 30, now()
) on conflict (id) do nothing;

insert into public.resources (id, tenant_id, name, kind, sort) values
  ('11111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Бокс 1', 'bay', 1),
  ('11111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Бокс 2', 'bay', 2),
  ('11111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Пост полировки', 'station', 3)
on conflict (id) do nothing;

insert into public.services (tenant_id, name, description, price_minor, duration_minutes, buffer_before_minutes, buffer_after_minutes, resource_kind, sort) values
  ('11111111-1111-1111-1111-111111111111', 'Комплексная мойка', 'Кузов, диски, салон, воск', 350000, 90, 10, 10, 'bay', 1),
  ('11111111-1111-1111-1111-111111111111', 'Полировка кузова', 'Абразивная полировка в 2 этапа', 1800000, 300, 30, 30, 'station', 2),
  ('11111111-1111-1111-1111-111111111111', 'Керамическое покрытие', 'Двухдневная защита кузова керамикой', 6500000, 2880, 60, 60, 'station', 3),
  ('11111111-1111-1111-1111-111111111111', 'Химчистка салона', 'Глубокая химчистка текстиля и кожи', 1200000, 240, 15, 15, 'bay', 4)
on conflict do nothing;

insert into public.working_hours (tenant_id, weekday, start_min, end_min)
select '11111111-1111-1111-1111-111111111111'::uuid, wd, 540, 1260
from generate_series(1, 6) as wd
on conflict do nothing;

insert into public.schedule_exceptions (tenant_id, date, is_closed, note)
values ('11111111-1111-1111-1111-111111111111', current_date + 10, true, 'Технический день')
on conflict (tenant_id, date) do nothing;

insert into public.info_cards (tenant_id, title, body, icon, sort) values
  ('11111111-1111-1111-1111-111111111111', 'Бокс закреплён за вами', 'Машина занимает бокс на всё время услуги, включая подготовку.', 'shield', 1),
  ('11111111-1111-1111-1111-111111111111', 'Честные сроки', 'Показываем реальную длительность: керамика — от двух дней.', 'clock', 2),
  ('11111111-1111-1111-1111-111111111111', 'Материалы уровня студии', 'Профессиональная химия и защитные составы.', 'sparkle', 3)
on conflict do nothing;

insert into public.media (tenant_id, kind, image_url, caption, sort, demo) values
  ('11111111-1111-1111-1111-111111111111', 'work', 'https://picsum.photos/seed/graphite-work-1/800/600', 'Полировка чёрного седана', 1, true),
  ('11111111-1111-1111-1111-111111111111', 'work', 'https://picsum.photos/seed/graphite-work-2/800/600', 'Керамика на купе', 2, true),
  ('11111111-1111-1111-1111-111111111111', 'work', 'https://picsum.photos/seed/graphite-work-3/800/600', 'Химчистка светлого салона', 3, true)
on conflict do nothing;

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner')
on conflict do nothing;

-- ============================== LUMEN Detailing =============================
insert into public.tenants (
  id, slug, name, tagline, description, accent, timezone, currency, locale, status, demo,
  phone, address, map_url, hero_image_url, logo_url,
  booking_lead_minutes, cancel_window_minutes, slot_step_minutes
) values (
  '22222222-2222-2222-2222-222222222222', 'lumen-detailing', 'LUMEN Detailing',
  'Светлый детейлинг в Екатеринбурге',
  'Экспресс-мойка и защитные покрытия. Два поста, запись без звонков.',
  '#22c55e', 'Asia/Yekaterinburg', 'RUB', 'ru-RU', 'preview', true,
  '+7 343 000-20-20', 'Екатеринбург, ул. Малышева, 51',
  'https://yandex.ru/maps/',
  'https://picsum.photos/seed/lumen-hero/1600/900',
  'https://picsum.photos/seed/lumen-logo/128/128',
  120, 720, 60
) on conflict (id) do nothing;

insert into public.resources (id, tenant_id, name, kind, sort) values
  ('22222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Пост A', 'bay', 1),
  ('22222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Пост детейлинга', 'station', 2)
on conflict (id) do nothing;

insert into public.services (tenant_id, name, description, price_minor, duration_minutes, buffer_before_minutes, buffer_after_minutes, resource_kind, sort) values
  ('22222222-2222-2222-2222-222222222222', 'Экспресс-мойка', 'Быстрая мойка кузова', 120000, 40, 5, 5, 'bay', 1),
  ('22222222-2222-2222-2222-222222222222', 'Полировка фар', 'Восстановление прозрачности фар', 600000, 120, 15, 15, 'station', 2),
  ('22222222-2222-2222-2222-222222222222', 'Нанокерамика', 'Однодневное защитное покрытие', 4500000, 1440, 30, 30, 'station', 3)
on conflict do nothing;

insert into public.working_hours (tenant_id, weekday, start_min, end_min)
select '22222222-2222-2222-2222-222222222222'::uuid, wd, 600, 1200
from generate_series(2, 6) as wd
union all select '22222222-2222-2222-2222-222222222222'::uuid, 0, 600, 1200
on conflict do nothing;

insert into public.info_cards (tenant_id, title, body, icon, sort) values
  ('22222222-2222-2222-2222-222222222222', 'Быстрая запись', 'Онлайн без звонков, подтверждение сразу.', 'sparkle', 1),
  ('22222222-2222-2222-2222-222222222222', 'Защита на год', 'Нанокерамика держится до 12 месяцев.', 'shield', 2)
on conflict do nothing;

insert into public.media (tenant_id, kind, image_url, caption, sort, demo) values
  ('22222222-2222-2222-2222-222222222222', 'work', 'https://picsum.photos/seed/lumen-work-1/800/600', 'Экспресс-мойка кроссовера', 1, true),
  ('22222222-2222-2222-2222-222222222222', 'work', 'https://picsum.photos/seed/lumen-work-2/800/600', 'Полировка фар', 2, true)
on conflict do nothing;

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner')
on conflict do nothing;
