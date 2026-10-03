# SETUP — локальный запуск, Supabase и публикация

PWA онлайн-записи для автосервисов и детейлинг-студий. Один статический
билд, один проект Supabase, много студий через `tenant_id`. Отдельного Node-
бэкенда нет: вся серверная логика — в Postgres и Edge Functions.

## 0. Требования

- Node.js 20+ и npm 10+ (проверено на Node 24 / npm 11).
- Аккаунт Supabase и [Supabase CLI](https://supabase.com/docs/guides/cli) — для БД и деплоя.
- Аккаунт Cloudflare Pages (или любой статический хостинг) — для фронтенда.

## 1. Установка

```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Фронтенд читает только `VITE_*`. Если `VITE_SUPABASE_URL` пуст — приложение
показывает честный экран «Supabase не настроен», а не падает.

## 2. База данных Supabase

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push          # применит supabase/migrations/*.sql
supabase db reset         # локально: миграции + seed
```

Всё в `supabase/migrations`:
- `0001` расширения и `current_user_id()`;
- `0002` схема (`tenants`, `services`, `resources`, `bookings`,
  `resource_occupancies` с GiST EXCLUDE, `payments`, `notification_jobs`, …);
- `0003` хелперы: валидация рабочих окон, `rpc_rate_limit`, `rpc_llm_consume`;
- `0004` атомарные бронирование/перенос/отмена и `rpc_get_availability`;
- `0005` outbox-уведомления с lease и дедупликацией;
- `0006` owner-функции и статистика (SQL);
- `0007` RLS, составные FK, строгие GRANT;
- `0008` триггеры `updated_at`;
- `0009` bucket `tenant-media`.

`supabase/seed.sql` создаёт двух демо-tenant'ов: **GRAPHITE Detailing**
(`Europe/Moscow`) и **LUMEN Detailing** (`Asia/Yekaterinburg`, preview).

Без Supabase можно поднять локальный Postgres для разработки и SQL-тестов:
`npm run db:start` (embedded-postgres, миграции + seed) или `npm run test:sql`.

## 3. Edge Functions

```bash
supabase functions deploy catalog availability bookings owner assistant notifications-worker ical
supabase functions deploy catalog --no-verify-jwt   # и так для публичных функций
```

Секреты для функций:

```bash
supabase secrets set \
  ACCESS_TOKEN_SECRET="$(openssl rand -hex 32)" \
  LLM_BASE_URL="https://..." LLM_API_KEY="..." LLM_MODEL="..." LLM_DAILY_LIMIT=500 \
  VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:you@example.com" \
  CRON_SECRET="$(openssl rand -hex 24)"
```

- `ACCESS_TOKEN_SECRET` — подпись токенов записи (в БД только sha256 хеш токена).
- `LLM_*` — необязательно: без них помощник отвечает через JSON-intent fallback.
- `VAPID_*` — Web Push. Без ключей задания помечаются `skipped`, доставка push не выполняется.

## 4. Cron для уведомлений

Раз в минуту вызывать воркер (Supabase Cron → HTTP, либо `pg_cron` + `pg_net`):

```
POST https://<project-ref>.functions.supabase.co/notifications-worker
Header: x-cron-secret: <CRON_SECRET>
```

Воркер берёт задания из `notification_jobs` через `FOR UPDATE SKIP LOCKED`,
дедуплицирует по `(tenant_id, dedupe_key)`, обрабатывает перенос/отмену.
**Preview-студии и demo-данные реальные уведомления не шлют.** На iPhone push
работает только для приложения, установленного на главный экран; в интерфейсе
это указано честно, а ICS-файл доступен всегда.

## 5. Владелец (вход)

Публичной регистрации нет. Создайте пользователя в Supabase Auth (Email/Password)
и добавьте членство:

```sql
insert into public.tenant_memberships (tenant_id, user_id, role)
select id, 'USER-UUID', 'owner' from public.tenants where slug = 'graphite-detailing';
```

Права проверяются на сервере (Edge Functions) по `tenant_memberships`.

## 6. Сборка и публикация фронтенда

```bash
npm run build               # dist/
npm run tenant:publish -- --slug graphite-detailing   # PWA-артефакты + публикация в БД
npm run tenant:publish -- --slug lumen-detailing
```

Публикация на **Cloudflare Pages (бесплатный тариф)**:

- подключите репозиторий, build command `npm run build`, output `dist`;
- задайте переменные `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`;
- fallback для глубоких ссылок уже включён: `public/_redirects` → `/* /index.html 200`
  (статические `dist/s/<slug>/index.html` и `sw.js` имеют приоритет);
- кэш настроен в `public/_headers`.

Деплой без репозитория одной командой (нужен `wrangler login`):

```bash
npm run build
npm run deploy:cf      # npx wrangler pages deploy dist --project-name booking-pwa
```

Помощник работает бесплатно: он не вызывает платный LLM, а маршрутизирует вопрос
к серверным SQL-инструментам и отвечает по реальным данным студии.

## 7. Проверки

```bash
npm run typecheck && npm run lint && npm run test && npm run build
npm run test:sql            # 12 SQL-тестов на реальном Postgres
npm run test:e2e            # Playwright: бронирование (mock API) + live-spec (E2E_LIVE=1)
npm run tenant:validate -- graphite-detailing
npm run tenant:verify -- graphite-detailing [--url https://site]
```

## 8. Переменные окружения

Полный список — в `.env.example`. Секреты (`SUPABASE_SERVICE_ROLE_KEY`,
`ACCESS_TOKEN_SECRET`, `LLM_API_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`) в
бандл не попадают: их читают только Edge Functions и скрипты. Проверка —
`grep` по `dist/` не находит ни одного значения/имени секрета.
