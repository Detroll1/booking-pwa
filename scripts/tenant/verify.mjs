// tenant:verify <slug> [--url https://...] — check the published studio:
// DB catalog via the Edge Function, local PWA artifacts, and optionally the
// deployed URL. Reports exactly what was and was not verified.
import path from 'node:path';
import {fileExists, readBusiness, repoRoot} from './lib.mjs';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const slug = arg('slug') ?? process.argv[2];
  if (!slug) {
    console.error('Укажите slug: npm run tenant:verify -- graphite-detailing');
    process.exit(1);
  }
  const {business} = await readBusiness(slug);
  const results = [];
  const check = (name, ok, note) => results.push({name, ok, note});

  // 1. Local PWA artifacts
  const manifestFile = path.join(repoRoot, 'dist', 's', business.slug, 'manifest.webmanifest');
  const indexFile = path.join(repoRoot, 'dist', 's', business.slug, 'index.html');
  const hasArtifacts = (await fileExists(manifestFile)) && (await fileExists(indexFile));
  check('PWA-артефакты (manifest + index.html)', hasArtifacts, hasArtifacts ? path.relative(repoRoot, manifestFile) : 'запустите npm run build и tenant:publish');

  // 2. Database + Edge Function catalog
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const response = await fetch(`${url}/functions/v1/catalog`, {
        method: 'POST',
        headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({slug: business.slug}),
      });
      const data = await response.json();
      const ok = response.ok && data?.tenant?.name === business.name && Array.isArray(data?.services);
      check('Каталог из БД (Edge Function)', ok, ok ? `${data.services.length} услуг` : `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 120)}`);
    } catch (error) {
      check('Каталог из БД (Edge Function)', false, error.message);
    }
  } else {
    check('Каталог из БД (Edge Function)', false, 'НЕ ПРОВЕРЕНО: нет SUPABASE_URL/SERVICE_ROLE_KEY');
  }

  // 3. Deployed URL (optional)
  const deployed = arg('url');
  if (deployed) {
    try {
      const response = await fetch(`${deployed.replace(/\/$/, '')}/s/${business.slug}/`);
      const html = await response.text();
      const ok = response.ok && /<div id="root">/.test(html);
      check('Опубликованная ссылка', ok, ok ? deployed : `HTTP ${response.status}`);
    } catch (error) {
      check('Опубликованная ссылка', false, error.message);
    }
  }

  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.note ? ` — ${r.note}` : ''}`);
    if (!r.ok) failed += 1;
  }
  if (!deployed) console.log('Опубликованная ссылка: не проверялась (нет --url).');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
