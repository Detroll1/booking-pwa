// tenant:new --slug <slug> — scaffold a new studio folder with a business.json
// template and an images folder. Nothing is published until tenant:publish.
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tenantDir, repoRoot} from './lib.mjs';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function template(slug) {
  return {
    slug,
    name: 'Название студии',
    tagline: 'Короткий слоган',
    description: 'Пара предложений о студии.',
    accent: '#4690ff',
    timezone: 'Europe/Moscow',
    currency: 'RUB',
    locale: 'ru-RU',
    status: 'preview',
    phone: '+7 900 000-00-00',
    address: 'Город, улица, дом',
    mapUrl: 'https://yandex.ru/maps/',
    heroImage: 'images/hero.jpg',
    logoImage: 'images/logo.png',
    bookingLeadMinutes: 60,
    cancelWindowMinutes: 180,
    slotStepMinutes: 30,
    resources: [{name: 'Бокс 1', kind: 'bay'}],
    services: [
      {name: 'Мойка', price: 2500, durationMinutes: 60, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'bay'},
    ],
    hours: {mon: [{start: '09:00', end: '20:00'}], tue: [{start: '09:00', end: '20:00'}]},
    works: [{image: 'images/work-1.jpg', caption: 'Пример работы'}],
    infoCards: [{title: 'Бокс закреплён за вами', body: 'Машина занимает бокс на всё время услуги.', icon: 'shield'}],
  };
}

async function main() {
  const slug = arg('slug', process.argv[2]);
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
    console.error('Укажите slug: npm run tenant:new -- --slug my-studio');
    process.exit(1);
  }
  const dir = tenantDir(slug);
  await mkdir(path.join(dir, 'images'), {recursive: true});
  await writeFile(path.join(dir, 'business.json'), JSON.stringify(template(slug), null, 2) + '\n', 'utf8');
  await writeFile(path.join(dir, 'images', '.gitkeep'), '', 'utf8');
  console.log(`Создано: ${path.relative(repoRoot, dir)}`);
  console.log('Заполните business.json, положите фото в images/, затем: npm run tenant:validate -- ' + slug);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
