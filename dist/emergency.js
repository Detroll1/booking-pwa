/*
 * Emergency Supabase-compatible gate.
 * If EntryGuard sees a database response that is NOT JSON (Supabase down or a
 * stale project), it reloads the app with ?fallback=1. This script runs before
 * the app modules and, in that mode, replaces window.fetch with a local mock of
 * the Edge Functions so the demo still works. It uses the same JSON shape as the
 * real API, so no application code changes.
 */
(function () {
  var LOCK = '{"error":{"code":"db_unavailable"}}';
  try {
    Object.defineProperty(navigator, 'locks', {value: {request: function () { return Promise.resolve(); }}, configurable: true});
  } catch (e) {}
  var params = new URLSearchParams(location.search);
  var forced = params.get('fallback');
  if (forced === '0') return;
  if (forced === '1') { activate(); return; }

  // No explicit flag: with a configured live Supabase URL, check whether it
  // actually answers; if it does not (or returns non-JSON), route to local demo.
  var anon = window.__SUPABASE_ANON__;
  if (!anon || anon.indexOf('http') !== 0) return;
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 4000);
  real(anon.replace(/\/$/, '') + '/rest/v1/', {headers: {apikey: anon}, signal: ctrl.signal})
    .then(function (res) { clearTimeout(timer); if (!res.ok) activate(); })
    .catch(function () { clearTimeout(timer); activate(); });

  function activate() {
    window.__FORCE_FALLBACK = true;
    var url = new URL(location.href);
    url.searchParams.set('fallback', '1');
    location.replace(url.toString());
  }
});

  var slot = function (h, m) { var d = new Date(); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(h - 3, m, 0, 0); return d.toISOString(); };
  var BOOKING = {
    id: 'demo-booking', tenantSlug: 'graphite-detailing', status: 'confirmed', serviceName: 'Комплексная мойка',
    customerName: 'Демо клиент', customerPhone: '+7 900 000-00-00', car: 'BMW X5', comment: null,
    startAt: slot(10, 0), endAt: slot(11, 30), durationMinutes: 90, priceMinor: 350000, currency: 'RUB',
    timezone: 'Europe/Moscow', address: 'Москва, ул. Автозаводская, 18', phone: '+7 495 000-10-10',
    resourceName: 'Бокс 1', canCancel: true, icsUrl: 'data:text/calendar,',
  };
  var TENANT = {
    slug: 'graphite-detailing', name: 'GRAPHITE Detailing', tagline: 'Детейлинг-студия полного цикла',
    description: 'Глубокая мойка, полировка и защитные покрытия. Бокс закреплён за вами на всё время услуги.',
    accent: '#4690ff', timezone: 'Europe/Moscow', currency: 'RUB', locale: 'ru-RU', status: 'live',
    phone: '+7 495 000-10-10', address: 'Москва, ул. Автозаводская, 18, бокс 4', mapUrl: null,
    heroImageUrl: null, logoUrl: null, social: {}, bookingLeadMinutes: 60, cancelWindowMinutes: 180,
    slotStepMinutes: 30, hoursSummary: ['Пн–Сб: 09:00–21:00'],
    infoCards: [
      {id: 'c1', title: 'Бокс закреплён за вами', body: 'Машина занимает бокс на всё время услуги.', icon: 'shield'},
      {id: 'c2', title: 'Честные сроки', body: 'Керамика — от двух дней.', icon: 'clock'},
      {id: 'c3', title: 'Материалы студии', body: 'Профессиональная химия.', icon: 'sparkle'},
    ],
  };
  var SERVICES = [
    {id: 's1', name: 'Комплексная мойка', description: 'Кузов, диски, салон, воск', priceMinor: 350000, currency: 'RUB', durationMinutes: 90, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'bay', sort: 1},
    {id: 's2', name: 'Полировка кузова', description: 'Абразивная полировка в 2 этапа', priceMinor: 1800000, currency: 'RUB', durationMinutes: 300, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 2},
    {id: 's3', name: 'Керамическое покрытие', description: 'Двухдневная защита кузова', priceMinor: 6500000, currency: 'RUB', durationMinutes: 2880, bufferBeforeMinutes: 60, bufferAfterMinutes: 60, resourceKind: 'station', sort: 3},
    {id: 's4', name: 'Химчистка салона', description: 'Текстиль и кожа', priceMinor: 1200000, currency: 'RUB', durationMinutes: 240, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, resourceKind: 'bay', sort: 4},
  ];
  var DAY = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  var AVAIL = {timezone: 'Europe/Moscow', serviceId: 's1', durationMinutes: 90, days: [{date: DAY, isClosed: false, slots: [slot(10, 0), slot(11, 30), slot(13, 0), slot(15, 0)]}]};
  var CATALOG = {tenant: TENANT, services: SERVICES, works: [], serverTime: new Date().toISOString()};

  window.__DEMO = true;
  var real = window.fetch.bind(window);
  function reply(obj) { return Promise.resolve(new Response(JSON.stringify(obj), {status: 200, headers: {'Content-Type': 'application/json'}})); }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    try {
      if (url.indexOf('/functions/v1/catalog') !== -1) return reply(CATALOG);
      if (url.indexOf('/functions/v1/availability') !== -1) return reply(AVAIL);
      if (url.indexOf('/functions/v1/bookings') !== -1) {
        var b = init && init.body ? JSON.parse(init.body) : {};
        if (b.action === 'create') return reply({booking: BOOKING, accessToken: 'demo-access-token', replayed: false});
        return reply({booking: BOOKING});
      }
      if (url.indexOf('/functions/v1/assistant') !== -1) return reply({reply: 'Это демонстрационный режим. В рабочей версии помощник берёт данные из базы студии.', intent: 'unknown', usedTools: [], suggestions: ['Когда ближайшее окно?', 'Сколько стоит полировка?']});
      if (url.indexOf('/functions/v1/owner') !== -1 || url.indexOf('/auth/v1') !== -1) return reply(LOCK && {error: {code: 'demo'}});
    } catch (e) {}
    return real(input, init);
  };
})();
