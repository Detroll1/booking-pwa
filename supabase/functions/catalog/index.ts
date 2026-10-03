import {handle, readJson, json, ApiError, clientIp} from '../_shared/http.ts';
import {serviceClient} from '../_shared/db.ts';
import {rpc} from '../_shared/rpc.ts';

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function minutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

interface HourRow {
  weekday: number;
  start_min: number;
  end_min: number;
}

function hoursSummary(hours: HourRow[]): string[] {
  const byDay = new Map<number, {start: number; end: number}[]>();
  for (const h of hours) {
    const list = byDay.get(h.weekday) ?? [];
    list.push({start: h.start_min, end: h.end_min});
    byDay.set(h.weekday, list);
  }
  const lines: string[] = [];
  for (let day = 1; day <= 6; day += 1) {
    const windows = byDay.get(day);
    if (windows && windows.length) {
      lines.push(`${WEEKDAYS[day]}: ${windows.map((w) => `${minutes(w.start)}–${minutes(w.end)}`).join(', ')}`);
    }
  }
  if (!byDay.has(6)) lines.push('суббота: выходной');
  lines.push(byDay.has(0) ? `${WEEKDAYS[0]}: ${byDay.get(0)!.map((w) => `${minutes(w.start)}–${minutes(w.end)}`).join(', ')}` : 'воскресенье: выходной');
  return lines;
}

Deno.serve((request) =>
  handle(request, async (req) => {
    const body = await readJson<{slug?: string; demo?: boolean}>(req);
    const slug = body.slug?.trim();
    if (!slug) throw new ApiError('bad_request', 'slug обязателен', 400);

    const client = serviceClient();
    const allowed = await rpc<boolean>(client, 'rpc_rate_limit', {
      p_key: `catalog:${clientIp(req)}`,
      p_limit: 300,
      p_window_seconds: 60,
    });
    if (!allowed) throw new ApiError('rate_limited', 'Слишком много запросов', 429);

    const {data: tenant, error} = await client.from('tenants').select('*').eq('slug', slug).maybeSingle();
    if (error) throw new ApiError('db_error', error.message, 500);
    if (!tenant) throw new ApiError('tenant_not_found', 'Студия не найдена', 404);

    const [services, media, cards, hours] = await Promise.all([
      client.from('services').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('sort'),
      client.from('media').select('*').eq('tenant_id', tenant.id).eq('kind', 'work').order('sort'),
      client.from('info_cards').select('*').eq('tenant_id', tenant.id).order('sort'),
      client.from('working_hours').select('*').eq('tenant_id', tenant.id).order('weekday'),
    ]);

    return json({
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        tagline: tenant.tagline,
        description: tenant.description,
        accent: tenant.accent,
        timezone: tenant.timezone,
        currency: tenant.currency,
        locale: tenant.locale,
        status: tenant.status,
        phone: tenant.phone,
        address: tenant.address,
        mapUrl: tenant.map_url,
        heroImageUrl: tenant.hero_image_url,
        logoUrl: tenant.logo_url,
        social: tenant.social ?? {},
        bookingLeadMinutes: tenant.booking_lead_minutes,
        cancelWindowMinutes: tenant.cancel_window_minutes,
        slotStepMinutes: tenant.slot_step_minutes,
        hoursSummary: hoursSummary((hours.data ?? []) as HourRow[]),
        infoCards: (cards.data ?? []).map((c) => ({id: c.id, title: c.title, body: c.body, icon: c.icon})),
      },
      services: (services.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        priceMinor: s.price_minor,
        currency: tenant.currency,
        durationMinutes: s.duration_minutes,
        bufferBeforeMinutes: s.buffer_before_minutes,
        bufferAfterMinutes: s.buffer_after_minutes,
        resourceKind: s.resource_kind,
        sort: s.sort,
      })),
      works: (media.data ?? []).map((m) => ({id: m.id, imageUrl: m.image_url, caption: m.caption, sort: m.sort})),
      serverTime: new Date().toISOString(),
    });
  }),
);
