// Shared helpers for the tenant pipeline. business.json is the only input that
// changes per studio; the database is the runtime source of truth.
import {readFile, writeFile, mkdir, copyFile, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const tenantsDir = path.join(repoRoot, 'tenants');

const timeWindow = z.object({start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/)});

export const businessSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'slug: только a-z, 0-9, дефис'),
  name: z.string().min(1),
  tagline: z.string().optional(),
  description: z.string().optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'accent: #RRGGBB'),
  timezone: z.string().min(1),
  currency: z.string().length(3),
  locale: z.string().min(2),
  status: z.enum(['preview', 'live']).default('preview'),
  phone: z.string().optional(),
  address: z.string().optional(),
  mapUrl: z.string().url().optional(),
  heroImage: z.string().optional(),
  logoImage: z.string().optional(),
  iconImage: z.string().optional(),
  bookingLeadMinutes: z.number().int().min(0).default(0),
  cancelWindowMinutes: z.number().int().min(0).default(0),
  slotStepMinutes: z.number().int().min(5).default(30),
  resources: z.array(z.object({name: z.string().min(1), kind: z.string().min(1)})).default([]),
  services: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number().nonnegative(),
        durationMinutes: z.number().int().min(5),
        bufferBeforeMinutes: z.number().int().min(0).default(0),
        bufferAfterMinutes: z.number().int().min(0).default(0),
        resourceKind: z.string().optional(),
      }),
    )
    .min(1),
  hours: z.record(z.string(), z.array(timeWindow)).default({}),
  works: z.array(z.object({image: z.string(), caption: z.string().optional()})).default([]),
  infoCards: z.array(z.object({title: z.string(), body: z.string(), icon: z.string().optional()})).default([]),
});

export function tenantDir(slug) {
  return path.join(tenantsDir, slug);
}

export async function readBusiness(slugOrPath) {
  const dir = slugOrPath.includes(path.sep) || slugOrPath.endsWith('.json') ? path.dirname(path.resolve(slugOrPath)) : tenantDir(slugOrPath);
  const file = slugOrPath.endsWith('.json') ? path.resolve(slugOrPath) : path.join(dir, 'business.json');
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const parsed = businessSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`business.json не прошёл проверку:\n${issues}`);
  }
  return {business: parsed.data, dir, file};
}

const WEEKDAY_INDEX = {sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6};

export function hoursToRows(business) {
  const rows = [];
  for (const [day, windows] of Object.entries(business.hours)) {
    const weekday = WEEKDAY_INDEX[day.toLowerCase()];
    if (weekday === undefined) continue;
    for (const w of windows) {
      rows.push({weekday, startMin: toMinutes(w.start), endMin: toMinutes(w.end)});
    }
  }
  return rows;
}

export function toMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function hoursSummary(business) {
  const rows = hoursToRows(business);
  const names = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const lines = [];
  for (let day = 0; day < 7; day += 1) {
    const windows = rows.filter((r) => r.weekday === day);
    if (windows.length) {
      lines.push(`${names[day]}: ${windows.map((w) => `${String(Math.floor(w.startMin / 60)).padStart(2, '0')}:${String(w.startMin % 60).padStart(2, '0')}–${String(Math.floor(w.endMin / 60)).padStart(2, '0')}:${String(w.endMin % 60).padStart(2, '0')}`).join(', ')}`);
    }
  }
  return lines;
}

export function buildManifest(business, baseUrl = '') {
  const scope = `/s/${business.slug}/`;
  return {
    id: scope,
    name: business.name,
    short_name: business.name.slice(0, 14),
    description: business.tagline ?? business.description ?? business.name,
    start_url: scope,
    scope,
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: business.accent,
    icons: [
      {src: `${baseUrl}${scope}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: `${baseUrl}${scope}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: `${baseUrl}${scope}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable'},
    ],
  };
}

export function placeholderSvg(name, accent) {
  const letter = name.trim().charAt(0).toUpperCase() || 'A';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${accent}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="260" font-weight="700" fill="#ffffff">${letter}</text>
</svg>`;
}

export function renderIndexHtml(template, business) {
  const scope = `/s/${business.slug}/`;
  const meta = [
    `<meta name="theme-color" content="${business.accent}" />`,
    `<meta name="apple-mobile-web-app-title" content="${business.name}" />`,
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
    `<meta property="og:title" content="${escapeHtml(business.name)}" />`,
    `<meta property="og:description" content="${escapeHtml(business.tagline ?? '')}" />`,
    `<link rel="manifest" href="${scope}manifest.webmanifest" />`,
    `<link rel="apple-touch-icon" href="${scope}apple-touch-icon.png" />`,
  ].join('\n    ');
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(business.name)}</title>`)
    .replace('</head>', `  ${meta}\n  </head>`);
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(file, data) {
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function copyInto(source, dir, targetName) {
  await mkdir(dir, {recursive: true});
  await copyFile(source, path.join(dir, targetName));
}

export function resolveTenantAsset(dir, relative) {
  return path.isAbsolute(relative) ? relative : path.join(dir, relative);
}
