import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {CalendarPlus, Clock, MapPin, Phone, BellRinging, Warning, CalendarDots, ShareNetwork} from '@phosphor-icons/react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import {useAvailability} from '@/hooks/useAvailability';
import {cn} from '@/lib/utils';
import {getIdempotencyKey, clearIdempotencyKey} from '@/lib/idem';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {Badge} from '@astryxdesign/core/Badge';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {TenantHeader} from '@/components/layout/TenantHeader';
import {useTenantContext} from '@/app/TenantContext';
import {TextInput} from '@astryxdesign/core/TextInput';
import {UserCircle} from '@phosphor-icons/react';
import {useBookingByToken, useCancelBooking, useRescheduleBooking, useSubscribeReminder} from '@/hooks/useBooking';
import {formatZoned} from '@/lib/time/tz';
import {formatMoney} from '@/lib/money';
import {ApiFailure} from '@/lib/api/client';
import {tenantPath} from '@/lib/tenant/resolve';
import type {ApiBooking, BookingStatus} from '@/types/api';

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  arrived: 'Автомобиль принят',
  in_progress: 'В работе',
  completed: 'Готово',
  cancelled: 'Отменена',
  no_show: 'Не приехал',
};

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function MyBookingPage() {
  const {slug = '', token: tokenParam} = useParams();
  const {tenant, services} = useTenantContext();
  const [token, setToken] = useState<string | null>(tokenParam ?? null);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [reason, setReason] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState('');
  const [newStart, setNewStart] = useState<string | null>(null);
  const [pushState, setPushState] = useState<'idle' | 'subscribed' | 'unsupported' | 'denied' | 'error'>('idle');

  useEffect(() => {
    if (!token) {
      try {
        setToken(localStorage.getItem(`booking-access:${slug}`));
      } catch {
        setToken(null);
      }
    }
  }, [slug, token]);

  const query = useBookingByToken(slug, token);
  const cancel = useCancelBooking();
  const subscribe = useSubscribeReminder();
  const reschedule = useRescheduleBooking();
  const booking = query.data?.booking ?? null;

  const serviceId = services.find((s) => s.name === booking?.serviceName)?.id ?? null;
  const moveAvailability = useAvailability(slug, serviceId, moveDate || new Date().toISOString().slice(0, 10), 10);
  const moveDay = moveAvailability.data?.days.find((d) => d.date === moveDate) ?? null;

  async function shareLink() {
    const url = `${window.location.origin}/s/${slug}/booking/${token}`;
    try {
      await navigator.share({title: 'Моя запись', text: booking?.serviceName ?? 'Запись в студию', url});
    } catch {
      void navigator.clipboard?.writeText(url).catch(() => undefined);
    }
  }

  async function enableReminder() {
    const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
    if (!vapid || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState('denied');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        }));
      if (!token) return;
      await subscribe.mutateAsync({slug, token, subscription: subscription.toJSON()});
      setPushState('subscribed');
    } catch {
      setPushState('error');
    }
  }

  if (!token) {
    return (
      <>
        <TenantHeader />
        <VStack gap={4} padding={4} paddingBlockEnd={8}>
          <Button label="На главную" variant="ghost" size="sm" href={tenantPath(slug)} />
          <VStack gap={2} align="center" className="rounded-3xl border border-border bg-surface p-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full tenant-accent-soft text-tenant-accent">
              <UserCircle size={30} weight="fill" aria-hidden />
            </span>
            <Heading level={1}>Профиль клиента</Heading>
            <Text type="supporting" justify="center">
              Сохраняйте новые записи в одном месте и открывайте их с любого устройства.
            </Text>
            <TextInput label="Почта" placeholder="mail@example.com" value={email} onChange={setEmail} isRequired />
            <Text type="supporting">Пароль не нужен. Отправим ссылку для входа.</Text>
            <Button
              label={linkSent ? 'Ссылка отправлена' : 'Получить ссылку'}
              variant="primary"
              width="100%"
              isDisabled={linkSent}
              onClick={() => setLinkSent(true)}
            />
          </VStack>
        </VStack>
      </>
    );
  }

  return (
    <>
      <TenantHeader />
      <VStack gap={4} padding={4} paddingBlockEnd={8}>
      <Heading level={1}>Моя запись</Heading>
      <AsyncBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
        {booking ? <BookingDetails booking={booking} locale={tenant.locale} /> : null}
      </AsyncBoundary>

      {booking && booking.status !== 'cancelled' ? (
        <VStack gap={3}>
          <Card padding={4}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="center">
                <CalendarPlus size={18} className="text-tenant-accent" aria-hidden />
                <Text type="body" weight="semibold">
                  Напоминание
                </Text>
              </HStack>
              <Text type="supporting">
                Добавьте визит в календарь — это работает всегда. Push-напоминание доступно после установки
                приложения (на iPhone — только из установленной на главный экран версии).
              </Text>
              <HStack gap={2}>
                <Button label="Поделиться" variant="secondary" size="sm" icon={<ShareNetwork size={16} />} onClick={() => void shareLink()} />
                {booking.canCancel ? (
                  <Button label="Перенести" variant="secondary" size="sm" icon={<CalendarDots size={16} />} onClick={() => setMoveOpen(true)} />
                ) : null}
              </HStack>
              <Button label="Добавить в календарь" variant="secondary" width="100%" href={booking.icsUrl} />
              {pushState === 'subscribed' ? (
                <Text type="supporting">Push-напоминание включено.</Text>
              ) : pushState === 'denied' ? (
                <Text type="supporting">Уведомления запрещены в настройках браузера.</Text>
              ) : pushState === 'unsupported' ? (
                <Text type="supporting">Push в этом браузере без установки приложения недоступен.</Text>
              ) : pushState === 'error' ? (
                <Text type="supporting">Не удалось включить уведомления. Попробуйте ещё раз.</Text>
              ) : (
                <Button
                  label="Включить push-напоминание"
                  variant="ghost"
                  width="100%"
                  icon={<BellRinging size={16} />}
                  onClick={() => void enableReminder()}
                />
              )}
            </VStack>
          </Card>

          {booking.canCancel ? (
            <Card padding={4}>
              <VStack gap={3}>
                <Text type="body" weight="semibold">
                  Отмена записи
                </Text>
                <Text type="supporting">
                  Отменить можно не позднее чем за {tenant.cancelWindowMinutes} мин до визита.
                </Text>
                <input
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-primary"
                  placeholder="Причина (необязательно)"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                {cancel.error ? (
                  <HStack gap={2} vAlign="center">
                    <Warning size={16} aria-hidden />
                    <Text type="supporting">
                      {cancel.error instanceof ApiFailure ? cancel.error.message : 'Не удалось отменить'}
                    </Text>
                  </HStack>
                ) : null}
                <Button
                  label={cancel.isPending ? 'Отменяем…' : 'Отменить запись'}
                  variant="destructive"
                  width="100%"
                  isLoading={cancel.isPending}
                  onClick={() => {
                    if (token) void cancel.mutateAsync({slug, token, reason});
                  }}
                />
              </VStack>
            </Card>
          ) : null}
        </VStack>
      ) : null}
      </VStack>

      <Drawer open={moveOpen} onOpenChange={setMoveOpen} swipeDirection="down">
        <DrawerContent>
          <DrawerHeader>
            <HStack hAlign="between" vAlign="center">
              <DrawerTitle>Перенести запись</DrawerTitle>
              <DrawerClose className="rounded-md px-2 py-1 text-sm text-secondary hover:text-primary">Закрыть</DrawerClose>
            </HStack>
          </DrawerHeader>
          <VStack gap={3}>
            <input
              type="date"
              aria-label="Другая дата"
              value={moveDate}
              onChange={(e) => {
                setMoveDate(e.target.value);
                setNewStart(null);
              }}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-primary"
            />
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
                    <Text type="body" weight="medium" hasTabularNumbers>
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
              isDisabled={!newStart || !token}
              isLoading={reschedule.isPending}
              onClick={() => {
                if (!newStart || !token) return;
                const scope = `client-move:${slug}:${booking?.id}:${newStart}`;
                reschedule.mutate(
                  {slug, token, startAt: newStart, idempotencyKey: getIdempotencyKey(scope)},
                  {
                    onSuccess: () => {
                      clearIdempotencyKey(scope);
                      setMoveOpen(false);
                      setNewStart(null);
                      void query.refetch();
                    },
                  },
                );
              }}
            />
          </VStack>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function BookingDetails({booking, locale}: {booking: ApiBooking; locale: string}) {
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <Text type="body" weight="semibold">
            {booking.serviceName}
          </Text>
          <Badge variant={booking.status === 'cancelled' ? 'neutral' : 'blue'} label={STATUS_LABEL[booking.status]} />
        </HStack>
        <Divider />
        <HStack gap={2} vAlign="center">
          <Clock size={16} className="text-tenant-accent" aria-hidden />
          <Text type="body">
            {formatZoned(new Date(booking.startAt), 'EEEE, d MMMM, HH:mm', booking.timezone)}
          </Text>
        </HStack>
        {booking.address ? (
          <HStack gap={2} vAlign="center">
            <MapPin size={16} className="text-tenant-accent" aria-hidden />
            <Text type="body">{booking.address}</Text>
          </HStack>
        ) : null}
        {booking.phone ? (
          <HStack gap={2} vAlign="center">
            <Phone size={16} className="text-tenant-accent" aria-hidden />
            <a href={`tel:${booking.phone}`} className="text-primary underline">
              <Text type="body">{booking.phone}</Text>
            </a>
          </HStack>
        ) : null}
        <Divider />
        <HStack hAlign="between" gap={2}>
          <Text type="supporting">Стоимость</Text>
          <Text type="body" weight="semibold">
            {formatMoney(booking.priceMinor, booking.currency, locale)}
          </Text>
        </HStack>
      </VStack>
    </Card>
  );
}
