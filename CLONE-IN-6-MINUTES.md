# Новая студия за 6 минут

Один билд обслуживает любое число студий. Новая студия не заменяет предыдущие:
у каждой свой `tenant_id`, свой адрес `/s/<slug>/` и свои PWA-артефакты.

## Минутa 1–2. Создать конфиг

```bash
npm run tenant:new -- --slug nova-detailing
```

Откройте `tenants/nova-detailing/business.json` и заполните:

- `name`, `tagline`, `description`, `accent` (один акцент, `#RRGGBB`);
- `timezone` (IANA, например `Europe/Kazan`), `phone`, `address`, `mapUrl`;
- `heroImage`, `logoImage`, `iconImage` — пути к файлам в `tenants/nova-detailing/images/`
  (или готовые URL);
- `services[]` — название, цена в рублях, длительность, буферы, `resourceKind`;
- `resources[]` — боксы/посты (`kind` совпадает с `resourceKind` услуг);
- `hours` — окна приёма по дням (`mon`…`sun`);
- `works[]` и `infoCards[]` — фотографии работ и три карточки на главной.

## Минута 3. Положить фото

Скопируйте фото в `tenants/nova-detailing/images/`. Имена должны совпадать с
`business.json`. Файлы загружаются в Supabase Storage при публикации.
Фото, загруженные владельцем в кабинете, при переиздании конфига не затираются.

## Минута 4. Проверить

```bash
npm run tenant:validate -- nova-detailing
```

Скрипт покажет график, число услуг и ресурсов. Для `status: "live"` проверит
наличие услуги, ресурсов, телефона, адреса и часов.

## Минута 5. Опубликовать

```bash
npm run build
npm run tenant:publish -- --slug nova-detailing
```

Публикация идемпотентна и не удаляет брони:
- услуги и ресурсы сопоставляются по имени — история заездов сохраняется;
- демо-фотографии заменяются, фото владельца остаются;
- создаются `dist/s/nova-detailing/` : `manifest.webmanifest`,
  `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`,
  per-tenant `index.html` и scoped `sw.js`.

Без `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` публикация сгенерирует PWA-артефакты
и честно сообщит, что выгрузка в БД пропущена.

## Минута 6. Проверить готовую ссылку

```bash
npm run tenant:verify -- nova-detailing --url https://your-site.pages.dev
```

Проверяются: PWA-артефакты, каталог из БД через Edge Function и (при `--url`)
отдача оболочки по адресу `/s/nova-detailing/`.

## Сменить оформление у уже живой студии

Отредактируйте `business.json` и снова выполните `tenant:publish`. Записи,
платежи и загруженные владельцем фотографии сохраняются; меняются данные и
внешний вид.
