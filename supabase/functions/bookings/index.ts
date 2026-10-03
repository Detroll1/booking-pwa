import {handle, readJson, json, ApiError, clientIp} from '../_shared/http.ts';
import {serviceClient, accessTokenSecret} from '../_shared/db.ts';
import {rpc} from '../_shared/rpc.ts';
import {bookingToken, sha256Hex} from '../_shared/token.ts';

interface BookingJson {
  id: string;
  tenantSlug: string;
  [key: string]: unknown;
}

function icsUrl(slug: string, token: string): string {
  const base = Deno.env.get('SUPABASE_URL') ?? '';
  return `${base}/functions/v1/ical?tenant=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;
}

async function resolveBookingId(client: ReturnType<typeof serviceClient>, token: string): Promise<{id: string; json: BookingJson}> {
  if (!token) throw new ApiError('unauthorized', 'Токен записи не передан', 401);
  const hash = await sha256Hex(token);
  const found = await rpc<BookingJson | null>(client, 'rpc_find_booking_by_token', {p_token_hash: hash});
  if (!found) throw new ApiError('booking_not_found', 'Запись не найдена', 404);
  return {id: found.id, json: found};
}

Deno.serve((request) =>
  handle(request, async (req) => {
    const body = await readJson<Record<string, unknown>>(req);
    const action = String(body.action ?? '');
    const slug = String(body.slug ?? '');
    if (!slug) throw new ApiError('bad_request', 'slug обязателен', 400);
    const client = serviceClient();

    const {data: tenant} = await client.from('tenants').select('*').eq('slug', slug).maybeSingle();
    if (!tenant) throw new ApiError('tenant_not_found', 'Студия не найдена', 404);

    if (action === 'create') {
      const allowed = await rpc<boolean>(client, 'rpc_rate_limit', {
        p_key: `book:${clientIp(req)}:${slug}`,
        p_limit: 12,
        p_window_seconds: 60,
      });
      if (!allowed) throw new ApiError('rate_limited', 'Слишком много попыток. Попробуйте позже.', 429);

      const customer = (body.customer ?? {}) as Record<string, unknown>;
      const result = await rpc<{booking: BookingJson; accessToken: string; replayed: boolean}>(
        client,
        'rpc_create_booking',
        {
          p_tenant_id: tenant.id,
          p_service_id: String(body.serviceId),
          p_start: String(body.startAt),
          p_customer: {
            name: String(customer.name ?? ''),
            phone: String(customer.phone ?? ''),
            car: customer.car ? String(customer.car) : null,
            comment: customer.comment ? String(customer.comment) : null,
          },
          p_idempotency_key: body.idempotencyKey ? String(body.idempotencyKey) : null,
          p_source: 'client',
          p_secret: accessTokenSecret(),
          p_demo: tenant.demo === true,
        },
      );
      result.booking.icsUrl = icsUrl(slug, result.accessToken);
      return json(result);
    }

    const token = bookingToken(req);

    if (action === 'get') {
      const {json: booking} = await resolveBookingId(client, token);
      booking.icsUrl = icsUrl(slug, token);
      return json({booking});
    }

    if (action === 'cancel') {
      const {id} = await resolveBookingId(client, token);
      const result = await rpc<{booking: BookingJson}>(client, 'rpc_cancel_booking', {
        p_booking_id: id,
        p_actor: 'client',
        p_reason: body.reason ? String(body.reason) : 'client',
      });
      result.booking.icsUrl = icsUrl(slug, token);
      return json(result);
    }

    if (action === 'reschedule') {
      const {id} = await resolveBookingId(client, token);
      const result = await rpc<{booking: BookingJson}>(client, 'rpc_reschedule_booking', {
        p_booking_id: id,
        p_new_start: String(body.startAt),
        p_actor: 'client',
        p_idempotency_key: body.idempotencyKey ? String(body.idempotencyKey) : null,
      });
      result.booking.icsUrl = icsUrl(slug, token);
      return json(result);
    }

    if (action === 'subscribe-push') {
      const {id} = await resolveBookingId(client, token);
      const subscription = (body.subscription ?? {}) as {endpoint?: string; keys?: unknown};
      if (!subscription.endpoint) throw new ApiError('bad_request', 'subscription.endpoint обязателен', 400);
      const {error} = await client
        .from('push_subscriptions')
        .upsert(
          {tenant_id: tenant.id, booking_id: id, endpoint: subscription.endpoint, keys: subscription.keys ?? {}, is_active: true},
          {onConflict: 'endpoint'},
        );
      if (error) throw new ApiError('db_error', error.message, 500);
      return json({ok: true});
    }

    throw new ApiError('bad_action', 'Неизвестное действие', 400);
  }),
);
