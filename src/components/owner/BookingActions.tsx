import {useState} from 'react';
import {Phone, CurrencyRub, Prohibit} from '@phosphor-icons/react';
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
} from '@/components/ui/drawer';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {useAddPayment, useOwnerCancel} from '@/hooks/useOwner';
import {parseMoneyToMinor} from '@/lib/money';
import {getIdempotencyKey, clearIdempotencyKey} from '@/lib/idem';
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
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'payment' | 'refund'>('payment');
  const [method, setMethod] = useState('card');

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
