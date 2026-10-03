// tenant:validate <slug> — check business.json before publishing.
import {readBusiness, hoursSummary, repoRoot} from './lib.mjs';
import path from 'node:path';

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Укажите slug или путь: npm run tenant:validate -- graphite-detailing');
    process.exit(1);
  }
  const {business, file} = await readBusiness(target);
  console.log(`OK: ${path.relative(repoRoot, file)}`);
  console.log(`  студия: ${business.name} (${business.slug})`);
  console.log(`  статус: ${business.status}, часовой пояс: ${business.timezone}, акцент: ${business.accent}`);
  console.log(`  ресурсов: ${business.resources.length}, услуг: ${business.services.length}`);
  const hours = hoursSummary(business);
  console.log(`  график: ${hours.length ? hours.join(' | ') : 'не задан'}`);
  if (business.status === 'live') {
    const missing = [];
    if (!business.services.length) missing.push('услуги');
    if (!business.resources.length) missing.push('ресурсы');
    if (!business.phone) missing.push('телефон');
    if (!business.address) missing.push('адрес');
    if (Object.keys(business.hours).length === 0) missing.push('часы работы');
    if (missing.length) {
      console.error(`  ВНИМАНИЕ: для live не хватает: ${missing.join(', ')}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
