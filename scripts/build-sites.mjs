// Post-build step for the free static host: generate one real HTML entry per
// studio at /s/<slug>/index.html. Cloudflare Pages serves the nearest
// index.html for a directory URL, so deep links work without _redirects.
import {readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const tenantsDir = join(root, 'tenants');

const index = readFileSync(join(dist, 'index.html'), 'utf8');

// Route folders inside a studio scope. A real index.html per route lets a
// static host serve the app shell on deep links with no rewrite rules.
const ROUTES = ['services', 'book', 'booking', 'owner', 'owner/login', 'owner/schedule', 'owner/bookings'];

for (const slug of readdirSync(tenantsDir)) {
  if (!existsSync(join(tenantsDir, slug, 'business.json'))) continue;
  const dir = join(dist, 's', slug);
  mkdirSync(dir, {recursive: true});
  const html = index.replace('<title>', `<title>${slug}</title><meta name="x-tenant" content="${slug}" />`);
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  writeFileSync(
    join(dir, 'manifest.webmanifest'),
    JSON.stringify(
      {
        id: `/s/${slug}/`,
        name: slug,
        short_name: slug.slice(0, 14),
        start_url: `/s/${slug}/`,
        scope: `/s/${slug}/`,
        display: 'standalone',
        background_color: '#0a0a0b',
        theme_color: '#4690ff',
        icons: [
          {src: '/hero.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any'},
          {src: '/hero.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'maskable'},
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  if (existsSync(join(dist, 'sw.js'))) cpSync(join(dist, 'sw.js'), join(dir, 'sw.js'));
  for (const route of ROUTES) {
    const routeDir = join(dir, route);
    mkdirSync(routeDir, {recursive: true});
    writeFileSync(join(routeDir, 'index.html'), html, 'utf8');
  }
  console.log('site generated:', `/s/${slug}/`);
}

// A catch-all 404 so unknown paths also boot the app (hash router).
writeFileSync(join(dist, '404.html'), index, 'utf8');
console.log('done');
