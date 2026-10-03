import {useMemo, useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose} from '@/components/ui/drawer';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useAvailability} from '@/hooks/useAvailability';
import {useCreateOwnerBooking, useOwnerServices} from '@/hooks/useOwner';
import {formatZoned, zonedDateKey} from '@/lib/time/tz';
import {formatMoney} from '@/lib/money';
import {getIdempotencyKey, clearIdempotencyKey} from '@/lib/idem';
import {cn} from '@/lib/utils';
import type {ApiCustomer} from '@/types/api';

export function ManualBookingSheet({
  slug,
  session,
  open,
  onOpenChange,
}: {
  slug: string;
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const services = useOwnerServices(slug, session);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState(() => zonedDateKey(new Date(), 'UTC'));
  const [startAt, setStartAt] = useState<string | null>(null);
  const [customer, setCustomer] = useState<ApiCustomer>({name: '', phone: '', car: '', comment: ''});
  const create = useCreateOwnerBooking(slug, session);
  const availability = useAvailability(slug, serviceId, date, 10);
  const day = useMemo(() => availability.data?.days.find((d) => d.date === date) ?? null, [availability.data, date]);

  const reset = () => {
    setServiceId(null);
    setStartAt(null);
    setCustomer({name: '', phone: '', car: '', comment: ''});
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <DrawerContent>
        <DrawerHeader>
          <HStack hAlign="between" vAlign="center" gap={2}>
            <DrawerTitle>Новая запись</DrawerTitle>
            <DrawerClose className="rounded-md px-2 py-1 text-sm text-secondary hover:text-primary">Закрыть</DrawerClose>
          </HStack>
        </DrawerHeader>
        <VStack gap={3}>
          <VStack gap={1}>
            <Text type="supporting">Услуга</Text>
            <HStack gap={2} wrap="wrap">
              {(services.data?.services ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {setServiceId(s.id); setStartAt(null);}}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left',
                    serviceId === s.id ? 'border-tenant-accent tenant-accent-soft' : 'border-border bg-surface',
                  )}
                >
                  <Text type="supporting" color="inherit">
                    {s.name} · {formatMoney(s.priceMinor, 'RUB')}
                  </Text>
                </button>
              ))}
            </HStack>
          </VStack>

          {serviceId ? (
            <>
              <TextInput label="Дата" value={date} onChange={setDate} placeholder="ГГГГ-ММ-ДД" />
              <AsyncBoundary isLoading={availability.isLoading} error={availability.error} isEmpty={(day?.slots.length ?? 0) === 0} emptyTitle="Нет свободного времени">
                <HStack gap={2} wrap="wrap">
                  {(day?.slots ?? []).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setStartAt(slot)}
                      className={cn(
                        'rounded-lg border px-3 py-1',
                        startAt === slot ? 'border-tenant-accent tenant-accent-soft' : 'border-border bg-surface',
                      )}
                    >
                      <Text type="supporting" color="inherit" hasTabularNumbers>
                        {formatZoned(new Date(slot), 'HH:mm', availability.data?.timezone ?? 'UTC')}
                      </Text>
                    </button>
                  ))}
                </HStack>
              </AsyncBoundary>
              <TextInput label="Имя клиента" value={customer.name} onChange={(v) => setCustomer({...customer, name: v})} isRequired />
              <TextInput label="Телефон" value={customer.phone} onChange={(v) => setCustomer({...customer, phone: v})} isRequired />
              <TextInput label="Автомобиль" value={customer.car ?? ''} onChange={(v) => setCustomer({...customer, car: v})} />
              <Button
                label={create.isPending ? 'Создаём…' : 'Создать запись'}
                variant="primary"
                width="100%"
                isLoading={create.isPending}
                onClick={() => {
                  if (!serviceId || !startAt) return;
                  const scope = `owner-book:${slug}:${serviceId}:${startAt}`;
                  create.mutate(
                    {serviceId, startAt, customer, idempotencyKey: getIdempotencyKey(scope)},
                    {
                      onSuccess: () => {
                        clearIdempotencyKey(scope);
                        reset();
                        onOpenChange(false);
                      },
                    },
                  );
                }}
              />
            </>
          ) : null}
        </VStack>
      </DrawerContent>
    </Drawer>
  );
}
