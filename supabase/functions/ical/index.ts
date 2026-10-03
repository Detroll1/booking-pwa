import {handle, text, ApiError} from '../_shared/http.ts';
import {serviceClient} from '../_shared/db.ts';
import {rpc} from '../_shared/rpc.ts';
import {sha256Hex} from '../_shared/token.ts';

interface BookingJson {
  id: string;
  tenantSlug: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  address: string | null;
  customerName: string;
}

function toUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildIcs(booking: BookingJson): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Booking PWA//Online booking//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@booking-pwa`,
    `DTSTAMP:${toUtc(new Date().toISOString())}`,
    `DTSTART:${toUtc(booking.startAt)}`,
    `DTEND:${toUtc(booking.endAt)}`,
    `SUMMARY:${escape(booking.serviceName)}`,
    booking.address ? `LOCATION:${escape(booking.address)}` : '',
    `DESCRIPTION:${escape(`Запись: ${booking.customerName}. Услуга: ${booking.serviceName}.`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Напоминание о записи',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.filter(Boolean).join('\r\n') + '\r\n';
}

Deno.serve((request) =>
  handle(request, async (req) => {
    const url = new URL(req.url);
    const tenantSlug = url.searchParams.get('tenant') ?? '';
    const token = url.searchParams.get('token') ?? '';
    if (!tenantSlug || !token) throw new ApiError('bad_request', 'tenant и token обязательны', 400);

    const client = serviceClient();
    const hash = await sha256Hex(token);
    const booking = await rpc<BookingJson | null>(client, 'rpc_find_booking_by_token', {p_token_hash: hash});
    if (!booking || booking.tenantSlug !== tenantSlug) {
      throw new ApiError('booking_not_found', 'Запись не найдена', 404);
    }
    return text(buildIcs(booking), 'text/calendar; charset=utf-8');
  }),
);
