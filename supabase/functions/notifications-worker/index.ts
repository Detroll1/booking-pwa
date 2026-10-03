import webpush from 'web-push';
import {handle, json, ApiError} from '../_shared/http.ts';
import {serviceClient} from '../_shared/db.ts';
import {rpc} from '../_shared/rpc.ts';

interface Job {
  id: string;
  tenant_id: string;
  booking_id: string;
  kind: string;
  channel: string;
}

interface Subscription {
  endpoint: string;
  keys: Record<string, string>;
}

Deno.serve((request) =>
  handle(request, async (req) => {
    const secret = req.headers.get('x-cron-secret');
    if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
      throw new ApiError('unauthorized', 'Неверный cron-секрет', 401);
    }
    const client = serviceClient();
    await rpc(client, 'rpc_requeue_stale_notification_jobs', {});
    const jobs = await rpc<Job[]>(client, 'rpc_claim_notification_jobs', {p_limit: 50, p_lease_seconds: 120});

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
    const canPush = Boolean(publicKey && privateKey);
    if (canPush) webpush.setVapidDetails(subject, publicKey!, privateKey!);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const job of jobs) {
      const {data: tenant} = await client.from('tenants').select('status,demo').eq('id', job.tenant_id).single();
      // Preview tenants and demo data never trigger real notifications.
      if (!tenant || tenant.status !== 'live' || tenant.demo) {
        await rpc(client, 'rpc_finish_notification_job', {p_id: job.id, p_status: 'skipped', p_error: 'preview_or_demo'});
        skipped += 1;
        continue;
      }
      if (job.channel !== 'push' || !canPush) {
        await rpc(client, 'rpc_finish_notification_job', {p_id: job.id, p_status: 'skipped', p_error: 'push_not_configured'});
        skipped += 1;
        continue;
      }

      const {data: subs} = await client
        .from('push_subscriptions')
        .select('endpoint,keys')
        .eq('booking_id', job.booking_id)
        .eq('is_active', true);

      if (!subs || subs.length === 0) {
        await rpc(client, 'rpc_finish_notification_job', {p_id: job.id, p_status: 'skipped', p_error: 'no_subscription'});
        skipped += 1;
        continue;
      }

      const {data: booking} = await client.from('bookings').select('service_name,start_at,status').eq('id', job.booking_id).single();
      const payload = JSON.stringify({
        title: job.kind === 'booking_cancelled' ? 'Запись отменена' : 'Напоминание о записи',
        body: booking ? `${booking.service_name}: ${new Date(booking.start_at).toLocaleString('ru-RU')}` : 'Подробности в приложении',
        kind: job.kind,
      });

      let anySent = false;
      let lastError = '';
      for (const sub of subs as Subscription[]) {
        try {
          await webpush.sendNotification({endpoint: sub.endpoint, keys: sub.keys}, payload);
          anySent = true;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (lastError.includes('410') || lastError.includes('404')) {
            await client.from('push_subscriptions').update({is_active: false}).eq('endpoint', sub.endpoint);
          }
        }
      }

      if (anySent) {
        await rpc(client, 'rpc_finish_notification_job', {p_id: job.id, p_status: 'sent', p_error: null});
        sent += 1;
      } else {
        const status = job.kind === 'reminder_24h' ? 'failed' : 'sent';
        await rpc(client, 'rpc_finish_notification_job', {p_id: job.id, p_status: status, p_error: lastError});
        if (status === 'sent') sent += 1;
        else failed += 1;
      }
    }

    return json({claimed: jobs.length, sent, skipped, failed});
  }),
);
