// SQL/integration cases against a real Postgres. Each case gets the running
// clients and an `assert` helper; a thrown error fails the case.

export const GRAPHITE = '11111111-1111-1111-1111-111111111111';
export const LUMEN = '22222222-2222-2222-2222-222222222222';
const SECRET = 'test-secret';

async function futureStart(client, tenantId, hour = 10) {
  const {rows} = await client.query(
    `select ((d)::timestamp at time zone t.timezone) + make_interval(hours => $2) as ts
       from (select d from generate_series(current_date + 1, current_date + 12, interval '1 day') d
             where extract(dow from d) between 1 and 6 limit 1) x, public.tenants t
      where t.id = $1`,
    [tenantId, hour],
  );
  return rows[0].ts;
}

async function serviceId(client, tenantId, name) {
  const {rows} = await client.query('select id from public.services where tenant_id=$1 and name=$2', [tenantId, name]);
  return rows[0].id;
}

const customer = JSON.stringify({name: 'Тест Клиент', phone: '+7 900 111-22-33', car: 'Тестовое авто'});

export const cases = [
  {
    name: 'two resources: concurrent bookings both succeed on different resources',
    async run({client, newClient, assert}) {
      const svc = await serviceId(client, GRAPHITE, 'Комплексная мойка');
      const start = await futureStart(client, GRAPHITE);
      const a = newClient();
      const b = newClient();
      await Promise.all([a.connect(), b.connect()]);
      try {
        const [ra, rb] = await Promise.all([
          a.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'bay-a', 'client', SECRET, true]),
          b.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'bay-b', 'client', SECRET, true]),
        ]);
        assert(ra.rows[0].r.booking.id !== rb.rows[0].r.booking.id, 'two bookings created');
        assert(ra.rows[0].r.booking.resourceName !== rb.rows[0].r.booking.resourceName, 'different resources');
      } finally {
        await a.end();
        await b.end();
      }
    },
  },
  {
    name: 'single resource: concurrent bookings — exactly one wins',
    async run({client, newClient, assert}) {
      const svc = await serviceId(client, GRAPHITE, 'Полировка кузова');
      const start = await futureStart(client, GRAPHITE, 12);
      const a = newClient();
      const b = newClient();
      await Promise.all([a.connect(), b.connect()]);
      try {
        const results = await Promise.allSettled([
          a.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'st-1', 'client', SECRET, true]),
          b.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'st-2', 'client', SECRET, true]),
        ]);
        const ok = results.filter((r) => r.status === 'fulfilled');
        assert(ok.length === 1, `exactly one booking succeeded (got ${ok.length})`);
        const failed = results.find((r) => r.status === 'rejected');
        assert(failed.reason.code === 'P0006', 'loser failed with no_resource_available');
      } finally {
        await a.end();
        await b.end();
      }
    },
  },
  {
    name: 'multi-day occupancy blocks the resource across both days',
    async run({client, assert}) {
      const svc = await serviceId(client, GRAPHITE, 'Керамическое покрытие');
      const start = await futureStart(client, GRAPHITE, 11);
      const created = await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'ceramic', 'client', SECRET, true]);
      const bookingId = created.rows[0].r.booking.id;
      const occ = await client.query('select upper(during) - lower(during) as span from public.resource_occupancies where booking_id=$1', [bookingId]);
      assert(occ.rows[0].span.days >= 2, 'occupancy spans two or more days');

      const polish = await serviceId(client, GRAPHITE, 'Полировка кузова');
      let failed = false;
      try {
        await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8)', [GRAPHITE, polish, new Date(new Date(start).getTime() + 3600_000), customer, 'overlap', 'client', SECRET, true]);
      } catch (error) {
        failed = error.code === 'P0006';
      }
      assert(failed, 'overlapping station booking rejected');
    },
  },
  {
    name: 'resource block prevents booking in the blocked range',
    async run({client, assert}) {
      const resource = await client.query("select id from public.resources where tenant_id=$1 and kind='station' limit 1", [GRAPHITE]);
      const start = await futureStart(client, GRAPHITE, 16);
      const end = new Date(new Date(start).getTime() + 2 * 3600_000);
      await client.query('select public.rpc_block_resource($1,$2,$3,$4,$5)', [GRAPHITE, resource.rows[0].id, start, end, 'блок']);
      const svc = await serviceId(client, GRAPHITE, 'Полировка кузова');
      let blocked = false;
      try {
        await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8)', [GRAPHITE, svc, start, customer, 'blocked', 'client', SECRET, true]);
      } catch (error) {
        blocked = error.code === 'P0006';
      }
      assert(blocked, 'booking inside a block is rejected');
      await client.query("delete from public.resource_occupancies where tenant_id=$1 and kind='block'", [GRAPHITE]);
    },
  },
  {
    name: 'reschedule moves atomically; failed move keeps the original',
    async run({client, assert}) {
      const svc = await serviceId(client, GRAPHITE, 'Комплексная мойка');
      const start = await futureStart(client, GRAPHITE, 9);
      const created = await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'move-1', 'client', SECRET, true]);
      const id = created.rows[0].r.booking.id;
      const target = new Date(new Date(start).getTime() + 24 * 3600_000);
      const moved = await client.query('select public.rpc_reschedule_booking($1,$2,$3,$4) r', [id, target, 'owner', 'move-key']);
      assert(new Date(moved.rows[0].r.booking.startAt).getTime() === target.getTime(), 'booking moved');
      const old = await client.query('select count(*)::int c from public.resource_occupancies where booking_id=$1 and lower(during)=$2', [id, start]);
      assert(old.rows[0].c === 0, 'old occupancy removed');

      // Occupy the next target with a block, then try to move again: must fail and keep original.
      const blockedTarget = new Date(target.getTime() + 86_400_000);
      const resource = await client.query('select id from public.resources where tenant_id=$1 and kind=$2 order by sort limit 1', [GRAPHITE, 'bay']);
      await client.query('select public.rpc_block_resource($1,$2,$3,$4,$5)', [GRAPHITE, resource.rows[0].id, new Date(blockedTarget.getTime() - 3600_000), new Date(blockedTarget.getTime() + 5 * 3600_000), 'hold']);
      // block the other bay too
      const resource2 = await client.query('select id from public.resources where tenant_id=$1 and kind=$2 order by sort offset 1 limit 1', [GRAPHITE, 'bay']);
      await client.query('select public.rpc_block_resource($1,$2,$3,$4,$5)', [GRAPHITE, resource2.rows[0].id, new Date(blockedTarget.getTime() - 3600_000), new Date(blockedTarget.getTime() + 5 * 3600_000), 'hold']);
      let failed = false;
      try {
        await client.query('select public.rpc_reschedule_booking($1,$2,$3,$4)', [id, blockedTarget, 'owner', 'move-key-2']);
      } catch (error) {
        failed = error.code === 'P0006';
      }
      assert(failed, 'move into a blocked range failed');
      const still = await client.query('select start_at from public.bookings where id=$1', [id]);
      assert(new Date(still.rows[0].start_at).getTime() === target.getTime(), 'original booking retained after failed move');
      await client.query("delete from public.resource_occupancies where tenant_id=$1 and kind='block'", [GRAPHITE]);
    },
  },
  {
    name: 'create is idempotent by key',
    async run({client, assert}) {
      const svc = await serviceId(client, GRAPHITE, 'Химчистка салона');
      const start = await futureStart(client, GRAPHITE, 13);
      const first = await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'idem-1', 'client', SECRET, true]);
      const second = await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'idem-1', 'client', SECRET, true]);
      assert(first.rows[0].r.booking.id === second.rows[0].r.booking.id, 'same booking id');
      assert(second.rows[0].r.replayed === true, 'second call flagged as replay');
      assert(first.rows[0].r.accessToken === second.rows[0].r.accessToken, 'same access token re-issued');
      const count = await client.query('select count(*)::int c from public.bookings where idempotency_key=$1', ['idem-1']);
      assert(count.rows[0].c === 1, 'only one booking row');
    },
  },
  {
    name: 'historical price is frozen on the booking',
    async run({client, assert}) {
      const svc = await serviceId(client, GRAPHITE, 'Комплексная мойка');
      const start = await futureStart(client, GRAPHITE, 14);
      const before = await client.query('select price_minor from public.services where id=$1', [svc]);
      const created = await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'price-1', 'client', SECRET, true]);
      await client.query('update public.services set price_minor = price_minor + 100000 where id=$1', [svc]);
      const booking = await client.query('select price_minor from public.bookings where id=$1', [created.rows[0].r.booking.id]);
      assert(booking.rows[0].price_minor === before.rows[0].price_minor, 'booking kept the old price');
      await client.query('update public.services set price_minor=$2 where id=$1', [svc, before.rows[0].price_minor]);
    },
  },
  {
    name: 'tenant composite FK blocks cross-tenant references',
    async run({client, assert}) {
      const lumenSvc = await serviceId(client, LUMEN, 'Экспресс-мойка');
      let failed = false;
      try {
        await client.query(
          `insert into public.bookings (tenant_id, service_id, customer_name, customer_phone, start_at, end_at, duration_minutes, price_minor, currency, service_name)
           values ($1,$2,'x','+7','2026-06-01T10:00:00Z','2026-06-01T11:00:00Z',60,1000,'RUB','x')`,
          [GRAPHITE, lumenSvc],
        );
      } catch (error) {
        failed = error.code === '23503';
      }
      assert(failed, 'cross-tenant service reference rejected by FK');
    },
  },
  {
    name: 'RLS: owners see only their tenant; anon sees personal data nowhere',
    async run({client, assert}) {
      await client.query("select set_config('request.jwt.claim.sub', $1, false)", ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
      await client.query('set role authenticated');
      const mine = await client.query('select count(*)::int c from public.services where tenant_id=$1', [GRAPHITE]);
      const other = await client.query('select count(*)::int c from public.services where tenant_id=$1', [LUMEN]);
      assert(mine.rows[0].c > 0 && other.rows[0].c === 0, 'graphite owner sees only graphite');
      await client.query('reset role');
      await client.query("select set_config('request.jwt.claim.sub', $1, false)", ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']);
      await client.query('set role authenticated');
      const mineB = await client.query('select count(*)::int c from public.services where tenant_id=$1', [LUMEN]);
      const otherB = await client.query('select count(*)::int c from public.services where tenant_id=$1', [GRAPHITE]);
      assert(mineB.rows[0].c > 0 && otherB.rows[0].c === 0, 'lumen owner sees only lumen');
      await client.query('reset role');

      await client.query('set role anon');
      let anonBlocked = false;
      try {
        const res = await client.query('select count(*)::int c from public.bookings');
        anonBlocked = res.rows[0].c === 0;
      } catch {
        anonBlocked = true;
      }
      assert(anonBlocked, 'anon cannot read bookings');
      await client.query('reset role');
    },
  },
  {
    name: 'payments and SQL stats separate arrivals, completed and money',
    async run({client, assert}) {
      const svc = await serviceId(client, GRAPHITE, 'Комплексная мойка');
      const start = await futureStart(client, GRAPHITE, 15);
      const created = await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'stats-1', 'client', SECRET, true]);
      const id = created.rows[0].r.booking.id;
      await client.query("select public.rpc_owner_set_status($1,'arrived','test')", [id]);
      await client.query("select public.rpc_owner_set_status($1,'completed','test')", [id]);
      await client.query('select public.rpc_owner_add_payment($1,$2,$3,$4,$5,$6,$7)', [GRAPHITE, id, 350000, 'payment', 'card', 'pay-1', true]);
      await client.query('select public.rpc_owner_add_payment($1,$2,$3,$4,$5,$6,$7)', [GRAPHITE, id, 50000, 'refund', 'card', 'ref-1', true]);
      const stats = await client.query('select public.rpc_stats($1, current_date, current_date + 30) s', [GRAPHITE]);
      const s = stats.rows[0].s;
      assert(s.arrivals >= 1, 'arrivals counted');
      assert(s.completed >= 1, 'completed counted');
      assert(s.receivedMinor >= 350000, 'received money counted');
      assert(s.refundedMinor >= 50000, 'refunds counted');
      assert(s.upcomingMinor >= 0, 'upcoming value is tracked separately');
    },
  },
  {
    name: 'outbox enqueues, leases with skip-locked and cancels on cancellation',
    async run({client, assert}) {
      const svc = await serviceId(client, GRAPHITE, 'Комплексная мойка');
      const start = await futureStart(client, GRAPHITE, 17);
      const created = await client.query('select public.rpc_create_booking($1,$2,$3,$4,$5,$6,$7,$8) r', [GRAPHITE, svc, start, customer, 'outbox-1', 'client', SECRET, true]);
      const id = created.rows[0].r.booking.id;
      const jobs = await client.query('select count(*)::int c from public.notification_jobs where booking_id=$1', [id]);
      assert(jobs.rows[0].c >= 2, 'confirmation and reminder enqueued');

      const claimed = await client.query('select count(*)::int c from public.rpc_claim_notification_jobs(1000, 30)');
      assert(claimed.rows[0].c >= 1, 'due jobs leased');
      const claimedAgain = await client.query('select count(*)::int c from public.rpc_claim_notification_jobs(1000, 30)');
      assert(claimedAgain.rows[0].c === 0, 'leased jobs are not handed out twice');

      await client.query("select public.rpc_cancel_booking($1,'client','test')", [id]);
      const cancelled = await client.query(
        "select count(*)::int c from public.notification_jobs where booking_id=$1 and status='pending' and kind in ('booking_confirmed','reminder_24h')",
        [id],
      );
      assert(cancelled.rows[0].c === 0, 'pending confirmation/reminder jobs cancelled with the booking');
    },
  },
  {
    name: 'atomic rate limit and LLM budget counters',
    async run({client, assert}) {
      const k = `test-${Date.now()}`;
      const r1 = await client.query('select public.rpc_rate_limit($1,2,60) r', [k]);
      const r2 = await client.query('select public.rpc_rate_limit($1,2,60) r', [k]);
      const r3 = await client.query('select public.rpc_rate_limit($1,2,60) r', [k]);
      assert(r1.rows[0].r === true && r2.rows[0].r === true && r3.rows[0].r === false, 'fixed-window limit enforced');
      const l1 = await client.query('select public.rpc_llm_consume($1,10,10,1) r', [LUMEN]);
      const l2 = await client.query('select public.rpc_llm_consume($1,10,10,1) r', [LUMEN]);
      assert(l1.rows[0].r === true && l2.rows[0].r === false, 'daily LLM budget enforced');
    },
  },
];
