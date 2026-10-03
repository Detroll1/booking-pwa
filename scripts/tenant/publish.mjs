// tenant:publish <slug> — push business.json to the database and generate the
// per-tenant PWA artifacts (manifest, icons, per-tenant index.html, scoped sw).
// Republishing never deletes bookings or owner-uploaded photos.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {
  buildManifest,
  fileExists,
  hoursToRows,
  placeholderSvg,
  readBusiness,
  renderIndexHtml,
  repoRoot,
  resolveTenantAsset,
} from './lib.mjs';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function uploadIfLocal(supabase, tenantId, value, dir, folder) {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  const source = resolveTenantAsset(dir, value);
  if (!(await fileExists(source))) {
    console.warn(`  фото не найдено, пропускаю: ${value}`);
    return null;
  }
  const ext = path.extname(source).slice(1) || 'jpg';
  const key = `${tenantId}/${folder}/${Date.now()}-${path.basename(source)}`.replace(/[^\w./-]/g, '_');
  const body = await readFile(source);
  const {error} = await supabase.storage.from('tenant-media').upload(key, body, {
    upsert: true,
    contentType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  const {data} = supabase.storage.from('tenant-media').getPublicUrl(key);
  return data.publicUrl;
}

async function syncDatabase(business, dir) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('DB publish пропущен: не заданы SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.');
    console.warn('Артефакты PWA сгенерированы; для публикации в БД задайте секреты и повторите.');
    return false;
  }
  const supabase = createClient(url, key, {auth: {persistSession: false}});

  const hero = await uploadIfLocal(supabase, business.slug, business.heroImage, dir, 'hero');
  const logo = await uploadIfLocal(supabase, business.slug, business.logoImage, dir, 'logo');

  const tenantRow = {
    slug: business.slug,
    name: business.name,
    tagline: business.tagline ?? null,
    description: business.description ?? null,
    accent: business.accent,
    timezone: business.timezone,
    currency: business.currency,
    locale: business.locale,
    status: business.status,
    phone: business.phone ?? null,
    address: business.address ?? null,
    map_url: business.mapUrl ?? null,
    booking_lead_minutes: business.bookingLeadMinutes,
    cancel_window_minutes: business.cancelWindowMinutes,
    slot_step_minutes: business.slotStepMinutes,
    demo: business.status !== 'live',
    ...(hero ? {hero_image_url: hero} : {}),
    ...(logo ? {logo_url: logo} : {}),
  };
  const {data: tenant, error: tenantError} = await supabase
    .from('tenants')
    .upsert(tenantRow, {onConflict: 'slug'})
    .select('id')
    .single();
  if (tenantError) throw new Error(tenantError.message);
  const tenantId = tenant.id;

  // Resources: match by name so existing bookings keep their resource ids.
  const {data: existingResources} = await supabase.from('resources').select('id,name').eq('tenant_id', tenantId);
  const resourceByName = new Map((existingResources ?? []).map((r) => [r.name, r.id]));
  const resourceIds = [];
  for (const [index, resource] of business.resources.entries()) {
    const row = {tenant_id: tenantId, name: resource.name, kind: resource.kind, is_active: true, sort: index + 1};
    if (resourceByName.has(resource.name)) {
      const id = resourceByName.get(resource.name);
      await supabase.from('resources').update(row).eq('id', id);
      resourceIds.push(id);
    } else {
      const {data} = await supabase.from('resources').insert(row).select('id').single();
      if (data) resourceIds.push(data.id);
    }
  }
  await supabase.from('resources').update({is_active: false}).eq('tenant_id', tenantId).not('id', 'in', `(${resourceIds.length ? resourceIds.join(',') : '00000000-0000-0000-0000-000000000000'})`);

  // Services: match by name to preserve historical bookings.
  const {data: existingServices} = await supabase.from('services').select('id,name').eq('tenant_id', tenantId);
  const serviceByName = new Map((existingServices ?? []).map((s) => [s.name, s.id]));
  const serviceIds = [];
  for (const [index, service] of business.services.entries()) {
    const row = {
      tenant_id: tenantId,
      name: service.name,
      description: service.description ?? null,
      price_minor: Math.round(service.price * 100),
      duration_minutes: service.durationMinutes,
      buffer_before_minutes: service.bufferBeforeMinutes,
      buffer_after_minutes: service.bufferAfterMinutes,
      resource_kind: service.resourceKind ?? null,
      is_active: true,
      sort: index + 1,
    };
    if (serviceByName.has(service.name)) {
      const id = serviceByName.get(service.name);
      await supabase.from('services').update(row).eq('id', id);
      serviceIds.push(id);
    } else {
      const {data} = await supabase.from('services').insert(row).select('id').single();
      if (data) serviceIds.push(data.id);
    }
  }
  if (serviceIds.length) {
    await supabase.from('services').update({is_active: false}).eq('tenant_id', tenantId).not('id', 'in', `(${serviceIds.join(',')})`);
  }

  // Working hours and info cards are fully replaced.
  await supabase.from('working_hours').delete().eq('tenant_id', tenantId);
  const hourRows = hoursToRows(business).map((h) => ({tenant_id: tenantId, weekday: h.weekday, start_min: h.startMin, end_min: h.endMin}));
  if (hourRows.length) await supabase.from('working_hours').insert(hourRows);

  await supabase.from('info_cards').delete().eq('tenant_id', tenantId);
  if (business.infoCards.length) {
    await supabase.from('info_cards').insert(business.infoCards.map((c, i) => ({tenant_id: tenantId, title: c.title, body: c.body, icon: c.icon ?? null, sort: i + 1})));
  }

  // Demo works are replaced; owner-uploaded photos are left untouched.
  await supabase.from('media').delete().eq('tenant_id', tenantId).eq('kind', 'work').eq('is_owner_uploaded', false);
  let sort = 1;
  for (const work of business.works) {
    const imageUrl = await uploadIfLocal(supabase, tenantId, work.image, dir, 'works');
    if (!imageUrl) continue;
    await supabase.from('media').insert({tenant_id: tenantId, kind: 'work', image_url: imageUrl, caption: work.caption ?? null, sort, demo: true, is_owner_uploaded: false});
    sort += 1;
  }

  console.log(`DB: студия ${business.slug} опубликована (${tenantId}).`);
  return true;
}

async function generateArtifacts(business, dir) {
  const distDir = path.join(repoRoot, 'dist');
  const templateFile = path.join(distDir, 'index.html');
  const tenantDist = path.join(distDir, 's', business.slug);
  await mkdir(tenantDist, {recursive: true});

  if (!(await fileExists(templateFile))) {
    console.warn('dist/index.html не найден — сначала выполните npm run build. Артефакты PWA пропущены.');
    return false;
  }
  const template = await readFile(templateFile, 'utf8');
  await writeFile(path.join(tenantDist, 'index.html'), renderIndexHtml(template, business), 'utf8');

  const sw = path.join(distDir, 'sw.js');
  if (await fileExists(sw)) await copyFile(sw, path.join(tenantDist, 'sw.js'));

  const iconSource = business.iconImage ?? business.logoImage;
  const hasRaster = iconSource ? await fileExists(resolveTenantAsset(dir, iconSource)) : false;
  const manifest = buildManifest(business);
  if (hasRaster) {
    for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
      await copyFile(resolveTenantAsset(dir, iconSource), path.join(tenantDist, name));
    }
    await copyFile(resolveTenantAsset(dir, iconSource), path.join(tenantDist, 'apple-touch-icon.png'));
  } else {
    const svg = placeholderSvg(business.name, business.accent);
    await writeFile(path.join(tenantDist, 'icon.svg'), svg, 'utf8');
    await writeFile(path.join(tenantDist, 'icon-maskable.svg'), svg, 'utf8');
    manifest.icons = [
      {src: `/s/${business.slug}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any'},
      {src: `/s/${business.slug}/icon-maskable.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable'},
    ];
  }
  await writeFile(path.join(tenantDist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`PWA: dist/s/${business.slug}/manifest.webmanifest, index.html, sw.js, иконки.`);
  return true;
}

async function main() {
  const slug = arg('slug') ?? process.argv[2];
  if (!slug) {
    console.error('Укажите slug: npm run tenant:publish -- graphite-detailing');
    process.exit(1);
  }
  const {business, dir} = await readBusiness(slug);
  const artifacts = await generateArtifacts(business, dir);
  const db = await syncDatabase(business, dir);
  if (process.argv.includes('--require-db') && !db) {
    console.error('--require-db: публикация в БД не выполнена.');
    process.exit(1);
  }
  console.log(artifacts || db ? 'Готово.' : 'Нечего публиковать.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
