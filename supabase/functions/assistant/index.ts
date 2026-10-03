import {handle, readJson, json, ApiError, clientIp} from '../_shared/http.ts';
import {serviceClient} from '../_shared/db.ts';
import {requireOwner} from '../_shared/auth.ts';
import {rpc} from '../_shared/rpc.ts';
import {
  CLIENT_SUGGESTIONS,
  OWNER_SUGGESTIONS,
  allowedTools,
  detectIntent,
  fallbackReply,
  isOwnerIntent,
  type AssistantScope,
  type FallbackData,
  type Intent,
} from '../_shared/assistant-router.ts';
import {parseRequest, filterSlots} from '../../../src/lib/assistant/nlparse.ts';

/** Adapt the browser-focused filterSlots to the server slot shape. */
function filterByRequest(
  parsed: ReturnType<typeof parseRequest>,
  slots: {iso: string; label: string; dayLabel: string; hour: number}[],
): {iso: string; label: string; dayLabel: string; hour: number}[] {
  return filterSlots(parsed, slots);
}

// Free assistant: no paid LLM. It routes the question to a server-side tool and
// answers ONLY from real database data. Nothing is invented.

interface ToolContext {
  client: ReturnType<typeof serviceClient>;
  tenantId: string;
  scope: AssistantScope;
  currency: string;
  locale: string;
  timezone: string;
}

const money = (minor: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, {style: 'currency', currency, maximumFractionDigits: 0}).format(minor / 100);

async function runTool(name: string, ctx: ToolContext, args: Record<string, unknown>): Promise<FallbackData> {
  switch (name) {
    case 'get_services': {
      const {data} = await ctx.client
        .from('services')
        .select('name,price_minor,duration_minutes')
        .eq('tenant_id', ctx.tenantId)
        .eq('is_active', true)
        .order('sort');
      return {
        services: (data ?? []).map((s) => ({
          name: s.name as string,
          priceLabel: money(s.price_minor as number, ctx.currency, ctx.locale),
          durationMinutes: s.duration_minutes as number,
        })),
      };
    }
    case 'get_availability': {
      // Prefer the service matching the user's wording (e.g. "мойка").
      const keyword = (args.keyword as string | null) ?? null;
      let query = ctx.client
        .from('services')
        .select('id,name')
        .eq('tenant_id', ctx.tenantId)
        .eq('is_active', true)
        .order('sort');
      if (keyword) query = query.ilike('name', `%${keyword}%`);
      let {data: service} = await query.limit(1).maybeSingle();
      if (!service && keyword) {
        const fallback = await ctx.client
          .from('services')
          .select('id,name')
          .eq('tenant_id', ctx.tenantId)
          .eq('is_active', true)
          .order('sort')
          .limit(1)
          .maybeSingle();
        service = fallback.data;
      }
      if (!service) return {slots: []};
      const from = new Date().toISOString().slice(0, 10);
      const availability = await rpc<{days: {date: string; slots: string[]}[]}>(
        ctx.client,
        'rpc_get_availability',
        {p_tenant_id: ctx.tenantId, p_service_id: service.id, p_from: from, p_days: 7},
      );
      const todayKey = new Date().toISOString().slice(0, 10);
      const structured = (availability.days ?? []).flatMap((day) =>
        day.slots.slice(0, 6).map((iso) => {
          const label = new Date(iso).toLocaleString(ctx.locale, {timeZone: ctx.timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
          const hour = Number(new Date(iso).toLocaleString('en-GB', {timeZone: ctx.timezone, hour: '2-digit', hour12: false}));
          const prefix = day.date === todayKey ? 'сегодня ' : day.date === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? 'завтра ' : '';
          return {iso, label: prefix + label, dayLabel: prefix + label, hour};
        }),
      );
      const parsed = parseRequest(String(args.message ?? ''));
      const filtered = filterByRequest(parsed, structured);
      const chosen = (filtered.length ? filtered : structured).slice(0, 5);
      return {slots: chosen.map((s) => s.label), serviceName: service.name};
    }
    case 'get_tenant_info': {
      const {data: tenant} = await ctx.client.from('tenants').select('address,phone').eq('id', ctx.tenantId).single();
      return {address: tenant?.address ?? null, phone: tenant?.phone ?? null};
    }
    case 'get_stats': {
      const from = (args.from as string) ?? new Date().toISOString().slice(0, 10);
      const to = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const stats = await rpc<{arrivals: number; completed: number; receivedMinor: number; upcomingMinor: number}>(
        ctx.client,
        'rpc_stats',
        {p_tenant_id: ctx.tenantId, p_from: from, p_to: to},
      );
      return {
        arrived: stats.arrivals,
        completed: stats.completed,
        receivedLabel: money(stats.receivedMinor, ctx.currency, ctx.locale),
        upcomingLabel: money(stats.upcomingMinor, ctx.currency, ctx.locale),
      };
    }
    case 'get_schedule': {
      const from = (args.date as string) ?? new Date().toISOString().slice(0, 10);
      const schedule = await rpc<{days: {date: string; bookings: unknown[]}[]}>(ctx.client, 'rpc_owner_schedule', {
        p_tenant_id: ctx.tenantId,
        p_from: from,
        p_to: from,
      });
      return {todayCount: schedule.days?.[0]?.bookings?.length ?? 0};
    }
    default:
      return {};
  }
}

function toolForIntent(intent: Intent, scope: AssistantScope): string {
  if (scope === 'owner') {
    if (intent === 'owner_today') return 'get_schedule';
    if (intent === 'owner_week' || intent === 'owner_money') return 'get_stats';
  }
  if (intent === 'availability') return 'get_availability';
  if (intent === 'location' || intent === 'hours') return 'get_tenant_info';
  return 'get_services';
}

Deno.serve((request) =>
  handle(request, async (req) => {
    const body = await readJson<{scope?: AssistantScope; slug?: string; message?: string}>(req);
    const scope: AssistantScope = body.scope === 'owner' ? 'owner' : 'client';
    const slug = String(body.slug ?? '');
    const message = String(body.message ?? '').slice(0, 500);
    if (!slug || !message) throw new ApiError('bad_request', 'slug и message обязательны', 400);

    const client = serviceClient();
    let tenantId: string;
    if (scope === 'owner') {
      tenantId = (await requireOwner(req, slug)).tenantId;
    } else {
      const {data: tenant} = await client.from('tenants').select('id').eq('slug', slug).maybeSingle();
      if (!tenant) throw new ApiError('tenant_not_found', 'Студия не найдена', 404);
      tenantId = tenant.id;
    }

    const allowed = await rpc<boolean>(client, 'rpc_rate_limit', {
      p_key: `assistant:${scope}:${clientIp(req)}:${slug}`,
      p_limit: 30,
      p_window_seconds: 60,
    });
    if (!allowed) throw new ApiError('rate_limited', 'Слишком много вопросов. Подождите минуту.', 429);

    const {data: tenantRow} = await client.from('tenants').select('currency,locale,timezone').eq('id', tenantId).single();
    const ctx: ToolContext = {
      client,
      tenantId,
      scope,
      currency: tenantRow?.currency ?? 'RUB',
      locale: tenantRow?.locale ?? 'ru-RU',
      timezone: tenantRow?.timezone ?? 'UTC',
    };

    const parsed = parseRequest(message);
    // A client asking an owner question never reaches owner tools.
    const intent: Intent = scope === 'client' && isOwnerIntent(parsed.intent) ? 'services' : parsed.intent;
    const tool = toolForIntent(intent, scope);
    const usedTools: string[] = [];
    let data: FallbackData = {};
    if (allowedTools(scope).includes(tool)) {
      data = await runTool(tool, ctx, {keyword: parsed.serviceKeyword, message});
      usedTools.push(tool);
    }

    return json({
      reply: fallbackReply(intent, data),
      intent,
      usedTools,
      suggestions: scope === 'owner' ? OWNER_SUGGESTIONS : CLIENT_SUGGESTIONS,
    });
  }),
);
