# ACCEPTANCE — что реально проверено

Дата: 2026-10-03. Окружение: Windows, Node 24.20, npm 11.19, Chromium (Playwright).
Внешних credentials (Supabase, LLM, VAPID, Vercel/Cloudflare) в среде не было —
это явно отмечено ниже.

## Выполненные проверки (фактические результаты)

| Проверка | Команда | Результат |
|---|---|---|
| Типы | `npm run typecheck` | 0 ошибок (TS strict, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`) |
| Линт | `npm run lint` | 0 ошибок, 0 предупреждений (ESLint 9 flat + typescript-eslint) |
| Юнит-тесты | `npm test` | **21/21** в 5 файлах (timezone/DST, интервалы+буфер, рабочие часы, деньги, AI-роутер) |
| SQL/integration | `npm run test:sql` | **12/12** на реальном Postgres 17 (embedded-postgres) |
| Сборка | `npm run build` | успешно; `dist/sw.js` (injectManifest), CSS 224 КБ, JS 939 КБ (gzip ~286 КБ) |
| E2E (mock API) | `npm run test:e2e` | **3 passed, 1 skipped** (live-spec требует `E2E_LIVE=1`) |
| Тема | `astryx theme build src/themes/app/appTheme.ts` | предсобранная тема `app.css/app.js` подключена |
| Пайплайн (офлайн) | `tenant:validate`/`publish`/`verify` | валидация OK; артефакты `dist/s/graphite-detailing/*`; verify честно пометил БД как «НЕ ПРОВЕРЕНО» |
| Утечка секретов | grep по `dist/assets` | 0 совпадений на `SERVICE_ROLE/LLM_API_KEY/VAPID_PRIVATE/ACCESS_TOKEN_SECRET/CRON_SECRET` |
| Изоляция брендов | grep по `src/` и бандлу | 0 вхождений бизнес-имён (`GRAPHITE`, `LUMEN`) |

### Что покрывают SQL/integration-тесты (`tests/sql/cases.mjs`)

1. Конкурентная запись на один ресурс — побеждает ровно одна, вторая получает `no_resource_available`.
2. Два ресурса — обе конкурентные записи проходят на разные боксы.
3. Многодневная занятость (керамика 2 дня) блокирует пост на весь непрерывный диапазон.
4. Блокировка поста (`rpc_block_resource`) запрещает бронь внутри диапазона.
5. Перенос атомарен; **неудачный перенос сохраняет исходную бронь** (rollback).
6. Идемпотентность создания: повтор по ключу возвращает ту же запись и тот же токен.
7. Историческая цена: бронь хранит цену на момент создания.
8. Составной FK `(tenant_id, service_id)` запрещает кросс-tenant ссылки.
9. RLS: владелец видит только свой tenant, `anon` не читает персональные данные.
10. SQL-статистика разделяет заезды, выполненные заказы и полученные платежи; «будущая стоимость» — отдельно.
11. Outbox: постановка, lease через `SKIP LOCKED`, отмена заданий при отмене брони.
12. Атомарные счётчики: rate limit по окну и дневной бюджет LLM.

### Playwright

`tests/e2e/booking.spec.ts` (реальный браузер, API замокан на уровне сети):
выбор услуги → дата/время → контакты → подтверждение → экран успеха → открытие
«Моя запись»; проверка входа владельца без публичного signup; стартовые подсказки
помощника. `tests/e2e/booking.live.spec.ts` — тот же путь против реального
бэкенда, включается `E2E_LIVE=1 E2E_BASE_URL=... E2E_OWNER_EMAIL=... E2E_OWNER_PASSWORD=...`.

## НЕ проверено (остаётся на внешние зависимости)

Эти пункты требуют реальных сервисов и намеренно не выдаются за выполненные:

1. **Supabase (хостинг):** применение миграций, RLS и GRANT на живом проекте,
   работа `supabase db push`/`functions deploy`. Локально миграции и RLS
   проверены на embedded Postgres.
2. **Edge Functions в рантайме (Deno):** `catalog`, `availability`, `bookings`,
   `owner`, `assistant`, `notifications-worker`, `ical` не запускались — нужен
   Supabase CLI/Deno. Логика вынесена в SQL и продублирована там, где возможно.
3. **Помощник:** платный LLM удалён по требованию. Помощник бесплатный и
   rule-based: маршрутизирует вопрос к серверным SQL-инструментам и отвечает по
   реальным данным. Протестирован роутер интентов и сборка ответов (юнит-тесты).
   Рантайм Edge Function в Deno не запускался (нужен Supabase CLI).
4. **Web Push:** доставка уведомлений не проверялась (нет VAPID-ключей и
   подписок). Воркер и outbox с lease/дедупликацией покрыты SQL-тестами;
   preview/demo помечаются `skipped`.
5. **Установка PWA на реальные устройства** (standalone, иконки, splash) и
   офлайн-режим в браузере — не проверялись; артефакты манифеста и per-tenant
   `index.html`/`sw.js` генерируются.
6. **Публикация на Cloudflare Pages** и живая ссылка — конфиг готов
   (`public/_redirects`, `public/_headers`, `npm run deploy:cf`), но деплой не
   выполнялся: нужен вход в их аккаунт (`wrangler login`).
7. **Сквозной бронь → кабинет владельца на живой БД** — не выполнялся.
8. **OWNER_INVITES / создание пользователя Auth** — требует Supabase Auth.

Инструкции по каждому пункту — в `SETUP.md`.
