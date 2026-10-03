import {handle, readJson, json, ApiError, clientIp} from '../_shared/http.ts';
import {serviceClient} from '../_shared/db.ts';
import {rpc} from '../_shared/rpc.ts';

Deno.serve((request) =>
  handle(request, async (req) => {
    const body = await readJson<{slug?: string; serviceId?: string; fromDate?: string; days?: number}>(req);
    if (!body.slug || !body.serviceId || !body.fromDate) {
      throw new ApiError('bad_request', 'slug, serviceId и fromDate обязательны', 400);
    }
    const days = Math.min(Math.max(body.days ?? 14, 1), 31);
    const client = serviceClient();

    const allowed = await rpc<boolean>(client, 'rpc_rate_limit', {
      p_key: `availability:${clientIp(req)}`,
      p_limit: 600,
      p_window_seconds: 60,
    });
    if (!allowed) throw new ApiError('rate_limited', 'Слишком много запросов', 429);

    const {data: tenant, error} = await client.from('tenants').select('id').eq('slug', body.slug).maybeSingle();
    if (error) throw new ApiError('db_error', error.message, 500);
    if (!tenant) throw new ApiError('tenant_not_found', 'Студия не найдена', 404);

    const result = await rpc(client, 'rpc_get_availability', {
      p_tenant_id: tenant.id,
      p_service_id: body.serviceId,
      p_from: body.fromDate,
      p_days: days,
    });
    return json(result);
  }),
);
