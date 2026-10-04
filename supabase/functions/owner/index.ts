import type {SupabaseClient} from '@supabase/supabase-js';
import {handle, readJson, json, ApiError} from '../_shared/http.ts';
import {serviceClient, accessTokenSecret} from '../_shared/db.ts';
import {requireOwner} from '../_shared/auth.ts';
import {rpc} from '../_shared/rpc.ts';

async function assertBookingTenant(client: SupabaseClient, tenantId: string, bookingId: string): Promise<void> {
  const {data} = await client.from('bookings').select('id').eq('id', bookingId).eq('tenant_id', tenantId).maybeSingle();
  if (!data) throw new ApiError('booking_not_found', 'Запись не найдена', 404);
}

Deno.serve((request) =>
  handle(request, async (req) => {
    const body = await readJson<Record<string, unknown>>(req);
    const slug = String(body.slug ?? '');
    const action = String(body.action ?? '');
    const {user, tenantId, role} = await requireOwner(req, slug);
    const client = serviceClient();

    switch (action) {
      case 'me':
        return json({membership: {tenantId, tenantSlug: slug, role, email: user.email}});

      case 'schedule': {
        const result = await rpc(client, 'rpc_owner_schedule', {
          p_tenant_id: tenantId,
          p_from: String(body.from),
          p_to: String(body.to),
        });
        return json(result);
      }

      case 'bookings': {
        let query = client
          .from('bookings')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('start_at', `${String(body.from)}T00:00:00Z`)
          .lte('start_at', `${String(body.to)}T23:59:59Z`)
          .order('start_at');
        if (body.status) query = query.eq('status', String(body.status));
        const {data, error} = await query;
        if (error) throw new ApiError('db_error', error.message, 500);
        const ids = (data ?? []).map((b) => b.id);
        const [resources, tenant] = await Promise.all([
          client.from('resources').select('id,name').eq('tenant_id', tenantId),
          client.from('tenants').select('timezone,currency,cancel_window_minutes,address,phone').eq('id', tenantId).single(),
        ]);
        const resourceName = new Map((resources.data ?? []).map((r) => [r.id, r.name]));
        return json({
          bookings: (data ?? []).map((b) => ({
            id: b.id,
            tenantSlug: slug,
            status: b.status,
            serviceName: b.service_name,
            customerName: b.customer_name,
            customerPhone: b.customer_phone,
            car: b.customer_car,
            comment: b.customer_comment,
            startAt: b.start_at,
            endAt: b.end_at,
            durationMinutes: b.duration_minutes,
            priceMinor: b.price_minor,
            currency: b.currency,
            timezone: tenant.data?.timezone ?? 'UTC',
            address: tenant.data?.address ?? null,
            phone: tenant.data?.phone ?? null,
            resourceName: b.resource_id ? resourceName.get(b.resource_id) ?? null : null,
            canCancel: !['cancelled', 'completed', 'no_show'].includes(b.status),
            icsUrl: '',
          })),
          count: ids.length,
        });
      }

      case 'stats': {
        const result = await rpc(client, 'rpc_stats', {
          p_tenant_id: tenantId,
          p_from: String(body.from),
          p_to: String(body.to),
        });
        return json({stats: result});
      }

      case 'services': {
        const {data} = await client.from('services').select('*').eq('tenant_id', tenantId).order('sort');
        return json({
          services: (data ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            priceMinor: s.price_minor,
            durationMinutes: s.duration_minutes,
            bufferBeforeMinutes: s.buffer_before_minutes,
            bufferAfterMinutes: s.buffer_after_minutes,
            resourceKind: s.resource_kind,
            isActive: s.is_active,
            sort: s.sort,
          })),
        });
      }

      case 'resources': {
        const {data} = await client.from('resources').select('*').eq('tenant_id', tenantId).order('sort');
        return json({resources: (data ?? []).map((r) => ({id: r.id, name: r.name, kind: r.kind, isActive: r.is_active, sort: r.sort}))});
      }

      case 'hours': {
        const hours = await rpc(client, 'rpc_owner_hours', {p_tenant_id: tenantId});
        return json({hours});
      }

      case 'media': {
        const {data} = await client.from('media').select('*').eq('tenant_id', tenantId).eq('kind', 'work').order('sort');
        return json({
          tenantId,
          works: (data ?? []).map((m) => ({
            id: m.id,
            imageUrl: m.image_url,
            caption: m.caption,
            sort: m.sort,
            storagePath: m.storage_path,
          })),
        });
      }

      case 'jobs': {
        const jobs = await rpc(client, 'rpc_owner_jobs', {p_tenant_id: tenantId});
        return json({jobs});
      }

      case 'upsert-service': {
        const service = await rpc(client, 'rpc_owner_upsert_service', {p_tenant_id: tenantId, p_service: body.service ?? {}});
        return json({service});
      }

      case 'delete-service':
        await rpc(client, 'rpc_owner_delete_service', {p_tenant_id: tenantId, p_id: String(body.id)});
        return json({ok: true});

      case 'create-booking': {
        const {data: tenant} = await client.from('tenants').select('demo').eq('id', tenantId).single();
        const result = await rpc<{booking: Record<string, unknown>}>(client, 'rpc_create_booking', {
          p_tenant_id: tenantId,
          p_service_id: String(body.serviceId),
          p_start: String(body.startAt),
          p_customer: body.customer ?? {},
          p_idempotency_key: body.idempotencyKey ? String(body.idempotencyKey) : null,
          p_source: 'owner',
          p_secret: accessTokenSecret(),
          p_demo: tenant?.demo === true,
        });
        result.booking.icsUrl = '';
        return json(result);
      }

      case 'reschedule':
        await assertBookingTenant(client, tenantId, String(body.bookingId));
        return json(
          await rpc(client, 'rpc_reschedule_booking', {
            p_booking_id: String(body.bookingId),
            p_new_start: String(body.startAt),
            p_actor: 'owner',
            p_idempotency_key: body.idempotencyKey ? String(body.idempotencyKey) : null,
          }),
        );

      case 'cancel':
        await assertBookingTenant(client, tenantId, String(body.bookingId));
        return json(
          await rpc(client, 'rpc_cancel_booking', {
            p_booking_id: String(body.bookingId),
            p_actor: 'owner',
            p_reason: body.reason ? String(body.reason) : 'owner',
          }),
        );

      case 'set-status':
        await assertBookingTenant(client, tenantId, String(body.bookingId));
        return json({booking: await rpc(client, 'rpc_owner_set_status', {p_booking_id: String(body.bookingId), p_status: String(body.status), p_actor: 'owner'})});

      case 'add-payment':
        await assertBookingTenant(client, tenantId, String(body.bookingId));
        return json(
          await rpc(client, 'rpc_owner_add_payment', {
            p_tenant_id: tenantId,
            p_booking_id: String(body.bookingId),
            p_amount_minor: Number(body.amountMinor),
            p_kind: String(body.kind),
            p_method: String(body.method ?? 'card'),
            p_idempotency_key: body.idempotencyKey ? String(body.idempotencyKey) : null,
            p_demo: true,
          }),
        );

      case 'set-hours':
        await rpc(client, 'rpc_owner_set_hours', {p_tenant_id: tenantId, p_hours: body.hours ?? []});
        return json({ok: true});

      case 'upsert-media':
        return json({work: await rpc(client, 'rpc_owner_upsert_media', {p_tenant_id: tenantId, p_work: body.work ?? {}})});

      case 'delete-media':
        await rpc(client, 'rpc_owner_delete_media', {p_tenant_id: tenantId, p_id: String(body.id)});
        return json({ok: true});

      case 'set-cards':
        await rpc(client, 'rpc_owner_set_cards', {p_tenant_id: tenantId, p_cards: body.cards ?? []});
        return json({ok: true});

      case 'update-tenant':
        return json({tenant: await rpc(client, 'rpc_owner_update_tenant', {p_tenant_id: tenantId, p_patch: body.patch ?? {}})});

      default:
        throw new ApiError('bad_action', `Неизвестное действие: ${action}`, 400);
    }
  }),
);
