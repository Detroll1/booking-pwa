/*
 * Emergency Supabase-compatible gate for the static demo.
 * Runs before the app modules. When the page is opened with ?fallback=1 (or the
 * configured database does not answer), it replaces window.fetch with a local
 * mock of the Edge Functions, using the same JSON shape as the real API, so the
 * whole site is explorable without a backend.
 */
(function () {
  var LOCK = '{"error":{"code":"db_unavailable"}}';
  try {
    Object.defineProperty(navigator, 'locks', {
      value: {request: function () { return Promise.resolve(); }},
      configurable: true,
    });
  } catch (e) {}

  var slot = function (h, m) {
    var d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(h - 3, m, 0, 0);
    return d.toISOString();
  };
  var BOOKING = {
    id: 'demo-booking', tenantSlug: 'graphite-detailing', status: 'confirmed', serviceName: 'Экспресс-мойка',
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
    heroImageUrl: '/hero.jpg', logoUrl: null, social: {}, bookingLeadMinutes: 60, cancelWindowMinutes: 180,
    slotStepMinutes: 30, hoursSummary: ['Пн–Сб: 09:00–21:00'],
    serviceCount: 10, resourceCount: 3, minPriceMinor: 150000,
    infoCards: [
      {id: 'c1', title: 'Бокс закреплён за вами', body: 'Машина занимает бокс на всё время услуги.', icon: 'shield'},
      {id: 'c2', title: 'Честные сроки', body: 'Керамика — от двух дней.', icon: 'clock'},
      {id: 'c3', title: 'Материалы студии', body: 'Профессиональная химия.', icon: 'sparkle'},
    ],
  };
  var SERVICES = [
    {id: 's1', name: 'Экспресс-мойка', description: 'Кузов и диски без очереди', priceMinor: 150000, currency: 'RUB', durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 5, resourceKind: 'bay', sort: 1},
    {id: 's2', name: 'Комплексная мойка', description: 'Кузов, диски, салон, воск', priceMinor: 350000, currency: 'RUB', durationMinutes: 90, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'bay', sort: 2},
    {id: 's3', name: 'Химчистка салона', description: 'Текстиль и кожа', priceMinor: 1200000, currency: 'RUB', durationMinutes: 240, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, resourceKind: 'bay', sort: 3},
    {id: 's4', name: 'Озонирование салона', description: 'Устранение запахов', priceMinor: 250000, currency: 'RUB', durationMinutes: 45, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'bay', sort: 4},
    {id: 's5', name: 'Полировка фар', description: 'Возврат прозрачности', priceMinor: 600000, currency: 'RUB', durationMinutes: 120, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, resourceKind: 'station', sort: 5},
    {id: 's6', name: 'Детейлинг дисков', description: 'Очистка и защита', priceMinor: 450000, currency: 'RUB', durationMinutes: 120, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'station', sort: 6},
    {id: 's7', name: 'Полировка кузова', description: 'Абразивная полировка в 2 этапа', priceMinor: 1800000, currency: 'RUB', durationMinutes: 300, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 7},
    {id: 's8', name: 'Керамическое покрытие', description: 'Защита кузова на 1 день', priceMinor: 3500000, currency: 'RUB', durationMinutes: 1440, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 8},
    {id: 's9', name: 'Керамика двухдневная', description: 'Максимальная защита', priceMinor: 6500000, currency: 'RUB', durationMinutes: 2880, bufferBeforeMinutes: 60, bufferAfterMinutes: 60, resourceKind: 'station', sort: 9},
    {id: 's10', name: 'Защитная плёнка', description: 'Бампер и зоны риска', priceMinor: 1500000, currency: 'RUB', durationMinutes: 360, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 10},
  ];
  var DAY = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  var AVAIL = {timezone: 'Europe/Moscow', serviceId: 's1', durationMinutes: 60, days: [{date: DAY, isClosed: false, slots: [9, 10, 11, 12, 13, 14, 15, 16].map(function (h) { return slot(h, 0); })}]};
  var CATALOG = {tenant: TENANT, services: SERVICES, works: [], serverTime: new Date().toISOString()};

  function reply(obj) {
    return Promise.resolve(new Response(JSON.stringify(obj), {status: 200, headers: {'Content-Type': 'application/json'}}));
  }

  function activate() {
    window.__FORCE_FALLBACK = true;
    window.__DEMO = true;
    var real = window.fetch.bind(window);
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
        if (url.indexOf('/functions/v1/owner') !== -1 || url.indexOf('/auth/v1') !== -1) return reply(JSON.parse(LOCK));
      } catch (e) {}
      return real(input, init);
    };
  }

  var params = new URLSearchParams(location.search);
  var forced = params.get('fallback');
  if (forced === '1') { activate(); return; }
  if (forced === '0') return;

  var anon = window.__SUPABASE_ANON__;
  if (!anon || anon.indexOf('http') !== 0) { activate(); return; }
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 4000);
  fetch(anon.replace(/\/$/, '') + '/rest/v1/', {headers: {apikey: anon}, signal: ctrl.signal})
    .then(function (res) { clearTimeout(timer); if (!res.ok) activate(); })
    .catch(function () { clearTimeout(timer); activate(); });
})();
