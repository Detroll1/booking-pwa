import {useState} from 'react';
import {addDays, format, subDays} from 'date-fns';
import {useQuery} from '@tanstack/react-query';
import {CaretLeft, CaretRight} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {ownerApi} from '@/lib/api/owner';
import {useSetStatus} from '@/hooks/useOwner';
import {formatZoned} from '@/lib/time/tz';
import {formatMoney} from '@/lib/money';
import {BookingActions} from '@/components/owner/BookingActions';

export function OwnerBookingsPage() {
  const {slug, session} = useOwnerSession();
  const [from, setFrom] = useState(() => subDays(new Date(), 3));
  const [to, setTo] = useState(() => addDays(new Date(), 10));
  const [status, setStatus] = useState<string>('');
  const setStatusMutation = useSetStatus(slug, session);

  const query = useQuery({
    queryKey: ['owner', 'bookings', slug, format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'), status],
    queryFn: () => ownerApi.bookings(session.access_token, slug, format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'), status || undefined),
  });

  return (
    <VStack gap={4}>
      <Heading level={1}>Записи</Heading>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button label="Назад" variant="ghost" size="sm" icon={<CaretLeft size={16} />} onClick={() => {setFrom((d) => subDays(d, 7)); setTo((d) => subDays(d, 7));}} />
        <Text type="supporting">
          {format(from, 'd MMM')} — {format(to, 'd MMM')}
        </Text>
        <Button label="Вперёд" variant="ghost" size="sm" icon={<CaretRight size={16} />} onClick={() => {setFrom((d) => addDays(d, 7)); setTo((d) => addDays(d, 7));}} />
        <HStack gap={1}>
          {['', 'pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
            <Button key={s || 'all'} label={s || 'все'} variant={status === s ? 'primary' : 'ghost'} size="sm" onClick={() => setStatus(s)} />
          ))}
        </HStack>
      </HStack>

      <AsyncBoundary
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        isEmpty={(query.data?.bookings.length ?? 0) === 0}
        emptyTitle="Записей за период нет"
      >
        <VStack gap={2}>
          {(query.data?.bookings ?? []).map((booking) => (
            <Card key={booking.id} padding={3}>
              <VStack gap={2}>
                <HStack hAlign="between" gap={2} vAlign="center">
                  <VStack gap={0}>
                    <Text type="body" weight="semibold">
                      {formatZoned(new Date(booking.startAt), 'd MMM, HH:mm', booking.timezone)} · {booking.customerName}
                    </Text>
                    <Text type="supporting">
                      {booking.serviceName} · {booking.car ?? '—'} · {booking.status}
                    </Text>
                  </VStack>
                  <Text type="supporting">{formatMoney(booking.priceMinor, booking.currency)}</Text>
                </HStack>
                <Divider />
                <BookingActions
                  booking={booking}
                  onStatus={(next) => setStatusMutation.mutate({bookingId: booking.id, status: next})}
                  pending={setStatusMutation.isPending}
                />
              </VStack>
            </Card>
          ))}
        </VStack>
      </AsyncBoundary>
    </VStack>
  );
}
