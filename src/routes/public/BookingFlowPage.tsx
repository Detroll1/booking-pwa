import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {ArrowLeft, CheckCircle, Clock, MapPin} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useTenantContext} from '@/app/TenantContext';
import {useAvailability} from '@/hooks/useAvailability';
import {useCreateBooking} from '@/hooks/useBooking';
import {ContactForm, hasContactErrors, validateContact, type ContactFormErrors} from '@/components/booking/ContactForm';
import {formatMoney} from '@/lib/money';
import {formatZoned, zonedDateKey} from '@/lib/time/tz';
import {clearIdempotencyKey, getIdempotencyKey} from '@/lib/idem';
import {ApiFailure} from '@/lib/api/client';
import {tenantPath} from '@/lib/tenant/resolve';
import {cn} from '@/lib/utils';
import type {ApiBooking, ApiCustomer} from '@/types/api';

type Step = 'service' | 'time' | 'contact' | 'success';

const EMPTY_CUSTOMER: ApiCustomer = {name: '', phone: '', car: '', comment: ''};

export function BookingFlowPage() {
  const {slug = ''} = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {tenant, services} = useTenantContext();

  const [serviceId, setServiceId] = useState<string | null>(params.get('service'));
  const [step, setStep] = useState<Step>(params.get('service') ? 'time' : 'service');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [customer, setCustomer] = useState<ApiCustomer>(EMPTY_CUSTOMER);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmed, setConfirmed] = useState<ApiBooking | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const todayKey = useMemo(() => zonedDateKey(new Date(), tenant.timezone), [tenant.timezone]);

  const availability = useAvailability(slug, serviceId, todayKey, 14);
  const createBooking = useCreateBooking();

  useEffect(() => {
    if (availability.data && !selectedDate) {
      const firstOpen = availability.data.days.find((d) => !d.isClosed && d.slots.length > 0);
      setSelectedDate(firstOpen?.date ?? availability.data.days[0]?.date ?? todayKey);
    }
  }, [availability.data, selectedDate, todayKey]);

  const day = availability.data?.days.find((d) => d.date === selectedDate) ?? null;
  const errors: ContactFormErrors = showErrors ? validateContact(customer) : {};

  function close() {
    void navigate(tenantPath(slug, 'services'));
  }

  function chooseService(id: string) {
    setServiceId(id);
    setSelectedDate('');
    setStartAt(null);
    setStep('time');
  }

  async function confirm() {
    if (!serviceId || !startAt) return;
    setShowErrors(true);
    if (hasContactErrors(validateContact(customer))) return;
    const scope = `book:${slug}:${serviceId}:${startAt}`;
    const key = getIdempotencyKey(scope);
    try {
      const result = await createBooking.mutateAsync({
        slug,
        serviceId,
        startAt,
        customer,
        idempotencyKey: key,
        demo: tenant.status === 'preview',
      });
      clearIdempotencyKey(scope);
      setConfirmed(result.booking);
      setToken(result.accessToken);
      try {
        localStorage.setItem(`booking-access:${slug}`, result.accessToken);
      } catch {
        /* storage may be unavailable in private mode */
      }
      setStep('success');
    } catch {
      /* error surfaced below via createBooking.error */
    }
  }

  return (
    <Drawer open onOpenChange={(open) => !open && close()} modal swipeDirection="down">
      <DrawerContent>
        <DrawerHeader>
          <HStack gap={2} vAlign="center" hAlign="between">
            <HStack gap={2} vAlign="center">
              {step !== 'service' && step !== 'success' ? (
                <Button
                  label="Назад"
                  variant="ghost"
                  size="sm"
                  icon={<ArrowLeft size={16} />}
                  onClick={() => setStep(step === 'contact' ? 'time' : 'service')}
                />
              ) : null}
              <Heading level={2}>Запись в студию</Heading>
            </HStack>
            <DrawerClose className="rounded-md px-2 py-1 text-sm text-secondary hover:text-primary">
              Закрыть
            </DrawerClose>
          </HStack>
          <DrawerTitle className="sr-only">Оформление записи</DrawerTitle>
          <DrawerDescription className="sr-only">
            Выберите услугу, время и оставьте контакты
          </DrawerDescription>
        </DrawerHeader>

        {step === 'service' ? (
          <VStack gap={2}>
            {services.length === 0 ? (
              <AsyncBoundary isEmpty emptyTitle="Услуги пока не добавлены" />
            ) : (
              services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => chooseService(s.id)}
                  className="rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-tenant-accent"
                >
                  <HStack gap={2} vAlign="center" hAlign="between">
                    <VStack gap={1}>
                      <Text type="body" weight="medium">
                        {s.name}
                      </Text>
                      <Text type="supporting">{s.durationMinutes} мин</Text>
                    </VStack>
                    <Text type="body" weight="semibold">
                      {formatMoney(s.priceMinor, s.currency, tenant.locale)}
                    </Text>
                  </HStack>
                </button>
              ))
            )}
          </VStack>
        ) : null}

        {step === 'time' && service ? (
          <VStack gap={4}>
            <Card padding={3}>
              <HStack gap={2} vAlign="center" hAlign="between">
                <VStack gap={1}>
                  <Text type="body" weight="semibold">
                    {service.name}
                  </Text>
                  <HStack gap={2} vAlign="center">
                    <Clock size={14} className="text-tenant-accent" aria-hidden />
                    <Text type="supporting">{service.durationMinutes} мин</Text>
                    <Text type="supporting">{formatMoney(service.priceMinor, service.currency, tenant.locale)}</Text>
                  </HStack>
                </VStack>
                <Button label="Сменить" variant="ghost" size="sm" onClick={() => setStep('service')} />
              </HStack>
            </Card>

            <HStack gap={2} isScrollable>
              {(availability.data?.days ?? []).map((d) => {
                const label = formatZoned(new Date(`${d.date}T12:00:00Z`), 'EEE d', tenant.timezone);
                const disabled = d.isClosed || d.slots.length === 0;
                const active = d.date === selectedDate;
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setSelectedDate(d.date);
                      setStartAt(null);
                    }}
                    className={cn(
                      'shrink-0 rounded-xl border px-3 py-2',
                      active ? 'border-tenant-accent tenant-accent-soft' : 'border-border bg-surface',
                      disabled && 'opacity-40',
                    )}
                  >
                    <VStack gap={0}>
                      <Text type="supporting" color={active ? 'inherit' : 'secondary'}>
                        {label}
                      </Text>
                      <Text type="supporting" color="inherit">
                        {d.isClosed ? 'выходной' : `${d.slots.length} окон`}
                      </Text>
                    </VStack>
                  </button>
                );
              })}
            </HStack>

            <AsyncBoundary
              isLoading={availability.isLoading}
              error={availability.error}
              onRetry={() => void availability.refetch()}
              isEmpty={!availability.isLoading && (day?.slots.length ?? 0) === 0}
              emptyTitle="На этот день свободных окон нет"
              emptyHint="Выберите другой день."
            >
              <VStack gap={2}>
                <HStack gap={2} wrap="wrap">
                  {(day?.slots ?? []).map((slot) => {
                    const active = slot === startAt;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setStartAt(slot);
                          setStep('contact');
                        }}
                        className={cn(
                          'rounded-lg border px-3 py-2',
                          active ? 'border-tenant-accent tenant-accent-soft' : 'border-border bg-surface',
                        )}
                      >
                        <Text type="body" weight="medium" hasTabularNumbers>
                          {formatZoned(new Date(slot), 'HH:mm', tenant.timezone)}
                        </Text>
                      </button>
                    );
                  })}
                </HStack>
              </VStack>
            </AsyncBoundary>
          </VStack>
        ) : null}

        {step === 'contact' && service && startAt ? (
          <VStack gap={4}>
            <Card padding={3}>
              <VStack gap={1}>
                <Text type="body" weight="semibold">
                  {formatZoned(new Date(startAt), 'd MMMM, HH:mm', tenant.timezone)}
                </Text>
                <Text type="supporting">
                  {service.name} · {formatMoney(service.priceMinor, service.currency, tenant.locale)}
                </Text>
              </VStack>
            </Card>
            <ContactForm
              value={customer}
              onChange={setCustomer}
              errors={errors}
              showErrors={showErrors}
            />
            {createBooking.error ? (
              <Text type="supporting" role="alert">
                {createBooking.error instanceof ApiFailure
                  ? createBooking.error.message
                  : 'Не удалось создать запись. Попробуйте другое время.'}
              </Text>
            ) : null}
            <Button
              label={createBooking.isPending ? 'Создаём запись…' : 'Подтвердить запись'}
              variant="primary"
              width="100%"
              size="lg"
              isLoading={createBooking.isPending}
              onClick={() => void confirm()}
            />
          </VStack>
        ) : null}

        {step === 'success' && confirmed ? (
          <VStack gap={4}>
            <VStack gap={2} align="center" padding={4}>
              <CheckCircle size={48} weight="fill" className="text-tenant-accent" aria-hidden />
              <Heading level={2}>Вы записаны</Heading>
              <Text type="supporting" justify="center">
                Мы ждём вас. Сохраните ссылку на запись — по ней можно перенести или отменить визит.
              </Text>
            </VStack>
            <Card padding={3}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Clock size={16} className="text-tenant-accent" aria-hidden />
                  <Text type="body">{formatZoned(new Date(confirmed.startAt), 'EEEE, d MMMM, HH:mm', tenant.timezone)}</Text>
                </HStack>
                <HStack gap={2} vAlign="center">
                  <MapPin size={16} className="text-tenant-accent" aria-hidden />
                  <Text type="body">{confirmed.address ?? tenant.address ?? 'Адрес уточнит студия'}</Text>
                </HStack>
                <Divider />
                <Text type="supporting">
                  {confirmed.serviceName} · {formatMoney(confirmed.priceMinor, confirmed.currency, tenant.locale)}
                </Text>
              </VStack>
            </Card>
            <VStack gap={2}>
              <Button
                label="Открыть мою запись"
                variant="primary"
                width="100%"
                onClick={() => void navigate(tenantPath(slug, `booking/${token ?? confirmed.id}`))}
              />
              <Button label="На главную" variant="secondary" width="100%" onClick={() => void navigate(tenantPath(slug))} />
            </VStack>
          </VStack>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
