import {useMemo, useState} from 'react';
import {addDays, format, subDays} from 'date-fns';
import {CaretLeft, CaretRight, Plus} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {useOwnerSchedule, useOwnerStats, useSetStatus} from '@/hooks/useOwner';
import {formatZoned} from '@/lib/time/tz';
import {formatMoney} from '@/lib/money';
import {ownerPath} from '@/lib/tenant/resolve';
import {BookingActions} from '@/components/owner/BookingActions';
import {ManualBookingSheet} from '@/components/owner/ManualBookingSheet';
import type {ApiBooking} from '@/types/api';

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function OwnerSchedulePage() {
  const {slug, session} = useOwnerSession();
  const [selected, setSelected] = useState(() => new Date());
  const [manualOpen, setManualOpen] = useState(false);
  const from = dateKey(selected);
  const to = dateKey(selected);

  const schedule = useOwnerSchedule(slug, session, from, to);
  const stats = useOwnerStats(slug, session, from, to);
  const setStatus = useSetStatus(slug, session);

  const day = schedule.data?.days[0] ?? null;
  const timezone = schedule.data?.timezone ?? 'UTC';
  const bookings = useMemo(() => day?.bookings ?? [], [day]);

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center" gap={2}>
        <HStack gap={1} vAlign="center">
          <Button label="Предыдущий день" variant="ghost" size="sm" icon={<CaretLeft size={16} />} onClick={() => setSelected((d) => subDays(d, 1))} />
          <VStack gap={0}>
            <Heading level={2}>{format(selected, 'd MMMM')}</Heading>
            <Text type="supporting">{day?.isClosed ? 'Выходной' : 'Рабочий день'}</Text>
          </VStack>
          <Button label="Следующий день" variant="ghost" size="sm" icon={<CaretRight size={16} />} onClick={() => setSelected((d) => addDays(d, 1))} />
        </HStack>
        <Button label="Добавить" variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setManualOpen(true)} />
      </HStack>

      <HStack gap={2} isScrollable>
        <Card padding={3} width={160}>
          <VStack gap={0}>
            <Text type="supporting">Заезды</Text>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {stats.data?.stats.arrivals ?? 0}
            </Text>
          </VStack>
        </Card>
        <Card padding={3} width={160}>
          <VStack gap={0}>
            <Text type="supporting">Выполнено</Text>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {stats.data?.stats.completed ?? 0}
            </Text>
          </VStack>
        </Card>
        <Card padding={3} width={180}>
          <VStack gap={0}>
            <Text type="supporting">Получено</Text>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {formatMoney(stats.data?.stats.receivedMinor ?? 0, stats.data?.stats.currency ?? 'RUB')}
            </Text>
          </VStack>
        </Card>
      </HStack>

      <AsyncBoundary isLoading={schedule.isLoading} error={schedule.error} onRetry={() => void schedule.refetch()}>
        <VStack gap={2}>
          {bookings.length === 0 ? (
            <AsyncBoundary isEmpty emptyTitle="На этот день записей нет" emptyHint="Добавьте запись вручную." />
          ) : (
            bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                timezone={timezone}
                onStatus={(status) => setStatus.mutate({bookingId: booking.id, status})}
                pending={setStatus.isPending}
              />
            ))
          )}
        </VStack>
      </AsyncBoundary>

      <Text type="supporting">
        Ссылка для редактирования каталога и часов — в разделах ниже.{' '}
        <a className="underline" href={ownerPath(slug, 'settings')}>
          Настройки студии
        </a>
      </Text>

      <ManualBookingSheet slug={slug} session={session} open={manualOpen} onOpenChange={setManualOpen} />
    </VStack>
  );
}

function BookingRow({
  booking,
  timezone,
  onStatus,
  pending,
}: {
  booking: ApiBooking;
  timezone: string;
  onStatus: (status: string) => void;
  pending: boolean;
}) {
  return (
    <Card padding={3}>
      <VStack gap={2}>
        <HStack hAlign="between" gap={2} vAlign="center">
          <VStack gap={0}>
            <Text type="body" weight="semibold">
              {formatZoned(new Date(booking.startAt), 'HH:mm', timezone)} · {booking.customerName}
            </Text>
            <Text type="supporting">
              {booking.serviceName} · {booking.car ?? 'авто не указано'}
            </Text>
          </VStack>
          <Text type="supporting">{booking.status}</Text>
        </HStack>
        <Divider />
        <BookingActions booking={booking} onStatus={onStatus} pending={pending} />
      </VStack>
    </Card>
  );
}
