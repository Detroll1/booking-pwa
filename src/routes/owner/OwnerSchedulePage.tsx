import {useMemo, useState, type ComponentType} from 'react';
import {Link} from 'react-router-dom';
import {addDays, format, subDays} from 'date-fns';
import {
  CalendarBlank,
  Camera,
  CaretLeft,
  CaretRight,
  Images,
  MapPin,
  Plus,
  Scissors,
  SignOut,
  Tag,
} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Divider} from '@astryxdesign/core/Divider';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {useAuth} from '@/hooks/useAuth';
import {useOwnerSchedule, useOwnerStats, useSetStatus} from '@/hooks/useOwner';
import {formatZoned} from '@/lib/time/tz';
import {formatMoney} from '@/lib/money';
import {ownerPath} from '@/lib/tenant/resolve';
import {BookingActions} from '@/components/owner/BookingActions';
import {ManualBookingSheet} from '@/components/owner/ManualBookingSheet';
import {cn} from '@/lib/utils';

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function OwnerSchedulePage() {
  const {slug, session} = useOwnerSession();
  const {signOut} = useAuth();
  const [selected, setSelected] = useState(() => new Date());
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const [manualOpen, setManualOpen] = useState(false);

  const from = dateKey(period === 'week' ? subDays(selected, 0) : selected);
  const to = dateKey(period === 'week' ? addDays(selected, 6) : selected);

  const schedule = useOwnerSchedule(slug, session, from, to);
  const stats = useOwnerStats(slug, session, from, to);
  const setStatus = useSetStatus(slug, session);

  const timezone = schedule.data?.timezone ?? 'UTC';
  const bookings = useMemo(
    () => (schedule.data?.days ?? []).flatMap((day) => day.bookings ?? []),
    [schedule.data],
  );
  const statsData = stats.data?.stats;

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="start" gap={2}>
        <VStack gap={0}>
          <Heading level={1}>Расписание</Heading>
          <Text type="supporting">{slug}</Text>
        </VStack>
        <button
          type="button"
          aria-label="Выйти"
          onClick={() => void signOut()}
          className="rounded-lg border border-border p-2 text-secondary hover:text-primary"
        >
          <SignOut size={18} aria-hidden />
        </button>
      </HStack>

      <VStack gap={2}>
        <Text type="supporting">Дата</Text>
        <HStack gap={2} vAlign="center">
          <button
            type="button"
            aria-label="Предыдущий период"
            className="rounded-xl border border-border p-2 text-secondary hover:text-primary"
            onClick={() => setSelected((d) => subDays(d, period === 'week' ? 7 : 1))}
          >
            <CaretLeft size={16} aria-hidden />
          </button>
          <div className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-center">
            <Text type="body" weight="medium" hasTabularNumbers>
              {format(selected, 'd MMM yyyy')}
            </Text>
          </div>
          <button
            type="button"
            aria-label="Следующий период"
            className="rounded-xl border border-border p-2 text-secondary hover:text-primary"
            onClick={() => setSelected((d) => addDays(d, period === 'week' ? 7 : 1))}
          >
            <CaretRight size={16} aria-hidden />
          </button>
        </HStack>

        <HStack gap={0} className="rounded-full border border-border bg-surface p-1">
          {(['day', 'week'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={cn(
                'flex-1 rounded-full px-4 py-2 text-sm transition-colors',
                period === value ? 'bg-tenant-accent text-white' : 'text-secondary',
              )}
            >
              {value === 'day' ? 'День' : 'Неделя'}
            </button>
          ))}
        </HStack>
      </VStack>

      <HStack gap={2}>
        <StatCard label="Заезды" value={String(statsData?.arrivals ?? 0)} />
        <StatCard label="Выполнено" value={String(statsData?.completed ?? 0)} />
        <StatCard label="Получено" value={formatMoney(statsData?.receivedMinor ?? 0, statsData?.currency ?? 'RUB', 'ru-RU')} />
      </HStack>

      <VStack gap={2}>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-tenant-accent px-4 py-3 text-white"
        >
          <Plus size={18} aria-hidden />
          <Text type="body" weight="semibold" color="inherit">
            Добавить запись
          </Text>
        </button>
        <HStack gap={2} wrap="wrap">
          <ActionTile to={ownerPath(slug, 'settings')} icon={CalendarBlank} label="Часы работы" />
          <ActionTile to={ownerPath(slug, 'settings')} icon={MapPin} label="Контакты" />
          <ActionTile to={ownerPath(slug, 'media')} icon={Images} label="Карточки витрины" />
          <ActionTile to={ownerPath(slug, 'services')} icon={Scissors} label="Услуги" />
          <ActionTile to={ownerPath(slug, 'settings')} icon={Tag} label="Логотип" />
          <ActionTile to={ownerPath(slug, 'settings')} icon={Camera} label="Главное фото" />
          <ActionTile to={ownerPath(slug, 'media')} icon={Images} label="Работы" />
        </HStack>
      </VStack>

      <AsyncBoundary isLoading={schedule.isLoading} error={schedule.error} onRetry={() => void schedule.refetch()}>
        <VStack gap={2}>
          {bookings.length === 0 ? (
            <AsyncBoundary isEmpty emptyTitle="На этот период записей нет" emptyHint="Добавьте запись вручную." />
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} className="rounded-2xl border border-border bg-surface p-3">
                <VStack gap={2}>
                  <HStack hAlign="between" gap={2} vAlign="center">
                    <VStack gap={0}>
                      <Text type="body" weight="semibold">
                        {formatZoned(new Date(booking.startAt), 'd MMM, HH:mm', timezone)} · {booking.customerName}
                      </Text>
                      <Text type="supporting">
                        {booking.serviceName} · {booking.car ?? 'авто не указано'}
                      </Text>
                    </VStack>
                    <Text type="supporting">{booking.status}</Text>
                  </HStack>
                  <Divider />
                  <BookingActions
                    booking={booking}
                    onStatus={(status) => setStatus.mutate({bookingId: booking.id, status})}
                    pending={setStatus.isPending}
                  />
                </VStack>
              </div>
            ))
          )}
        </VStack>
      </AsyncBoundary>

      <ManualBookingSheet slug={slug} session={session} open={manualOpen} onOpenChange={setManualOpen} />
    </VStack>
  );
}

function StatCard({label, value}: {label: string; value: string}) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-surface px-3 py-2">
      <VStack gap={0}>
        <Text type="supporting">{label}</Text>
        <Text type="body" weight="semibold" hasTabularNumbers>
          {value}
        </Text>
      </VStack>
    </div>
  );
}

function ActionTile({
  to,
  icon: TileIcon,
  label,
}: {
  to: string;
  icon: ComponentType<{size?: number; 'aria-hidden'?: boolean}>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-[45%] flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-secondary hover:border-tenant-accent hover:text-primary"
    >
      <TileIcon size={18} aria-hidden />
      <Text type="supporting" color="inherit">
        {label}
      </Text>
    </Link>
  );
}
