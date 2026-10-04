import {useState} from 'react';
import {CalendarDots, Phone, CurrencyRub, Prohibit} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {useAddPayment, useOwnerCancel, useOwnerReschedule, useOwnerServices} from '@/hooks/useOwner';
import {useAvailability} from '@/hooks/useAvailability';
import {formatZoned, zonedDateKey} from '@/lib/time/tz';
import {parseMoneyToMinor} from '@/lib/money';
import {getIdempotencyKey, clearIdempotencyKey} from '@/lib/idem';
import {cn} from '@/lib/utils';
import type {ApiBooking} from '@/types/api';

export function BookingActions({
  booking,
  onStatus,
  pending,
}: {
  booking: ApiBooking;
  onStatus: (status: string) => void;
  pending: boolean;
}) {
  const {slug, session} = useOwnerSession();
  const cancel = useOwnerCancel(slug, session);
  const payment = useAddPayment(slug, session);
  const reschedule = useOwnerReschedule(slug, session);
  const services = useOwnerServices(slug, session);
  const [payOpen, setPayOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState(() => zonedDateKey(new Date(), 'UTC'));
  const [newStart, setNewStart] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'payment' | 'refund'>('payment');
  const [method, setMethod] = useState('card');

  const serviceId = (services.data?.services ?? []).find((s) => s.name === booking.serviceName)?.id ?? null;
  const moveAvailability = useAvailability(slug, serviceId, moveDate, 10);
  const moveDay = moveAvailability.data?.days.find((d) => d.date === moveDate) ?? null;

  const active = booking.status !== 'cancelled' && booking.status !== 'completed';

  return (
    <VStack gap={2}>
      <HStack gap={2} wrap="wrap">
        {booking.customerPhone ? (
          <Button
            label="Позвонить"
            variant="ghost"
            size="sm"
            icon={<Phone size={16} />}
            href={`tel:${booking.customerPhone}`}
          />
        ) : null}
        {booking.status === 'pending' || booking.status === 'confirmed' ? (
          <Button label="Машина принята" variant="secondary" size="sm" isLoading={pending} onClick={() => onStatus('arrived')} />
        ) : null}
        {booking.status === 'arrived' ? (
          <Button label="В работу" variant="secondary" size="sm" isLoading={pending} onClick={() => onStatus('in_progress')} />
        ) : null}
        {booking.status === 'in_progress' ? (
          <Button label="Готово" variant="primary" size="sm" isLoading={pending} onClick={() => onStatus('completed')} />
        ) : null}
        {active ? (
          <Button label="Перенести" variant="ghost" size="sm" icon={<CalendarDots size={16} />} onClick={() => setMoveOpen(true)} />
        ) : null}
        {active ? (
          <Button label="Оплата" variant="ghost" size="sm" icon={<CurrencyRub size={16} />} onClick={() => setPayOpen(true)} />
        ) : null}
        {active ? (
          <Button
            label="Отменить"
            variant="ghost"
            size="sm"
            icon={<Prohibit size={16} />}
            isLoading={cancel.isPending}
            onClick={() => cancel.mutate({bookingId: booking.id, reason: 'owner'})}
          />
        ) : null}
      </HStack>
      {cancel.error ? <Text type="supporting">Не удалось обновить запись.</Text> : null}

      <Drawer open={moveOpen} onOpenChange={setMoveOpen} swipeDirection="down">
        <DrawerContent>
          <DrawerHeader>
            <HStack hAlign="between" vAlign="center">
              <DrawerTitle>Перенести запись</DrawerTitle>
              <DrawerClose className="rounded-md px-2 py-1 text-sm text-secondary hover:text-primary">Закрыть</DrawerClose>
            </HStack>
          </DrawerHeader>
          <VStack gap={3}>
            <TextInput label="Дата" value={moveDate} onChange={setMoveDate} placeholder="ГГГГ-ММ-ДД" />
            <AsyncBoundary
              isLoading={moveAvailability.isLoading}
              error={moveAvailability.error}
              isEmpty={(moveDay?.slots.length ?? 0) === 0}
              emptyTitle="Нет свободного времени"
            >
              <HStack gap={2} wrap="wrap">
                {(moveDay?.slots ?? []).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setNewStart(slot)}
                    className={cn(
                      'rounded-lg border px-3 py-2',
                      newStart === slot ? 'border-tenant-accent tenant-accent-soft' : 'border-border bg-surface',
                    )}
                  >
                    <Text type="supporting" color="inherit" hasTabularNumbers>
                      {formatZoned(new Date(slot), 'HH:mm', moveAvailability.data?.timezone ?? 'UTC')}
                    </Text>
                  </button>
                ))}
              </HStack>
            </AsyncBoundary>
            {reschedule.error ? <Text type="supporting">Не удалось перенести. Это время занято?</Text> : null}
            <Button
              label={reschedule.isPending ? 'Переносим…' : 'Перенести'}
              variant="primary"
              width="100%"
              isDisabled={!newStart}
              isLoading={reschedule.isPending}
              onClick={() => {
                if (!newStart) return;
                const scope = `move:${booking.id}:${newStart}`;
                reschedule.mutate(
                  {bookingId: booking.id, startAt: newStart, idempotencyKey: getIdempotencyKey(scope)},
                  {
                    onSuccess: () => {
                      clearIdempotencyKey(scope);
                      setMoveOpen(false);
                      setNewStart(null);
                    },
                  },
                );
              }}
            />
          </VStack>
        </DrawerContent>
      </Drawer>

      <Drawer open={payOpen} onOpenChange={setPayOpen} swipeDirection="down">
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Оплата по записи</DrawerTitle>
          </DrawerHeader>
          <VStack gap={3}>
            <HStack gap={2}>
              <Button label="Оплата" variant={kind === 'payment' ? 'primary' : 'secondary'} size="sm" onClick={() => setKind('payment')} />
              <Button label="Возврат" variant={kind === 'refund' ? 'primary' : 'secondary'} size="sm" onClick={() => setKind('refund')} />
            </HStack>
            <TextInput label="Сумма" placeholder="0" value={amount} onChange={setAmount} isRequired />
            <HStack gap={2}>
              {['card', 'cash', 'transfer'].map((m) => (
                <Button
                  key={m}
                  label={m === 'card' ? 'Карта' : m === 'cash' ? 'Наличные' : 'Перевод'}
                  variant={method === m ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setMethod(m)}
                />
              ))}
            </HStack>
            <Button
              label={payment.isPending ? 'Сохраняем…' : 'Сохранить'}
              variant="primary"
              width="100%"
              isLoading={payment.isPending}
              onClick={() => {
                const minor = parseMoneyToMinor(amount);
                if (minor === null || minor <= 0) return;
                const scope = `pay:${booking.id}:${kind}:${minor}`;
                payment.mutate(
                  {bookingId: booking.id, amountMinor: minor, kind, method, idempotencyKey: getIdempotencyKey(scope)},
                  {onSuccess: () => {clearIdempotencyKey(scope); setPayOpen(false); setAmount('');}},
                );
              }}
            />
          </VStack>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
}
