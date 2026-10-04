import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {CaretRight, CheckCircle, Clock, MapPin, Sparkle, StarFour} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
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

type Step = 'intro' | 'service' | 'time' | 'contact' | 'review' | 'success';

const EMPTY_CUSTOMER: ApiCustomer = {name: '', phone: '', car: '', comment: ''};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} ч`;
  return `${Math.round(minutes / 1440)} д`;
}

export function BookingFlowPage() {
  const {slug = ''} = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {tenant, services} = useTenantContext();

  const [serviceId, setServiceId] = useState<string | null>(params.get('service'));
  const [step, setStep] = useState<Step>(params.get('service') ? 'time' : 'intro');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [customer, setCustomer] = useState<ApiCustomer>(EMPTY_CUSTOMER);
  const [showErrors, setShowErrors] = useState(false);
  const [consent, setConsent] = useState(false);
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
  const endAt = startAt && service ? new Date(new Date(startAt).getTime() + service.durationMinutes * 60_000) : null;

  function close() {
    void navigate(tenantPath(slug, ''));
  }

  function chooseService(id: string) {
    setServiceId(id);
    setSelectedDate('');
    setStartAt(null);
    setStep('time');
  }

  function toReview() {
    setShowErrors(true);
    if (hasContactErrors(validateContact(customer))) return;
    setStep('review');
  }

  async function confirm() {
    if (!serviceId || !startAt) return;
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
      /* error surfaced below */
    }
  }

  function autofill() {
    setCustomer({name: 'Демо клиент', phone: '+7 999 123-45-67', car: 'Марка и модель', comment: ''});
  }

  const titles: Partial<Record<Step, string>> = {
    service: 'Выбери услугу',
    time: 'Дата и время',
    contact: 'Ваш автомобиль',
    review: 'Проверьте запись',
  };
  const stepNumbers: Partial<Record<Step, number>> = {service: 1, time: 2, contact: 3, review: 4};
  const stepNumber = stepNumbers[step];

  return (
    <Drawer open onOpenChange={(open) => !open && close()} modal swipeDirection="down">
      <DrawerContent>
        <DrawerHeader>
          <HStack gap={2} vAlign="center" hAlign="between">
            <HStack gap={2} vAlign="center">
              <VStack gap={0}>
                <Heading level={2}>{titles[step] ?? 'Запись в студию'}</Heading>
                {stepNumber ? (
                  <Text type="supporting">Шаг {stepNumber} из 4</Text>
                ) : null}
              </VStack>
            </HStack>
            <DrawerClose className="rounded-md px-2 py-1 text-sm text-secondary hover:text-primary">Закрыть</DrawerClose>
          </HStack>
          {stepNumber ? (
            <HStack gap={1} aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i <= stepNumber ? 'bg-tenant-accent' : 'bg-border',
                  )}
                />
              ))}
            </HStack>
          ) : null}
          <DrawerTitle className="sr-only">Оформление записи</DrawerTitle>
          <DrawerDescription className="sr-only">Выберите услугу, время и оставьте контакты</DrawerDescription>
        </DrawerHeader>

        {step === 'intro' ? (
          <VStack gap={4} paddingInline={1} paddingBlock={2}>
            <VStack gap={3} align="center" className="rounded-3xl border border-border bg-surface px-5 py-8">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tenant-accent text-white">
                <Sparkle size={32} weight="fill" aria-hidden />
              </span>
              <Heading level={3}>Свежий вид для вашего авто</Heading>
              <Text type="supporting" justify="center">
                Выберите услугу и удобное время — остальное возьмём на себя
              </Text>
            </VStack>
            <Button label="Выбрать время" variant="primary" size="lg" width="100%" icon={<CaretRight size={18} />} onClick={() => setStep('service')} />
          </VStack>
        ) : null}

        {step === 'service' ? (
          <VStack gap={2}>
            {services.length === 0 ? (
              <AsyncBoundary isEmpty emptyTitle="Услуги пока не добавлены" />
            ) : (
              services.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border bg-surface p-3">
                  <HStack gap={3} vAlign="center">
                    <VStack gap={1} className="flex-1">
                      <Text type="body" weight="semibold">
                        {s.name}
                      </Text>
                      {s.description ? <Text type="supporting">{s.description}</Text> : null}
                      <Text type="supporting">{formatDuration(s.durationMinutes)}</Text>
                    </VStack>
                    <VStack gap={2} hAlign="end" className="shrink-0">
                      <Text type="body" weight="semibold">
                        {formatMoney(s.priceMinor, s.currency, tenant.locale)}
                      </Text>
                      <Button label="Выбрать" variant="secondary" size="sm" icon={<CaretRight size={14} />} onClick={() => chooseService(s.id)} />
                    </VStack>
                  </HStack>
                </div>
              ))
            )}
          </VStack>
        ) : null}

        {step === 'time' && service ? (
          <VStack gap={4}>
            <HStack gap={2} vAlign="center" hAlign="between">
              <Text type="body" weight="semibold">
                {service.name}
              </Text>
              <Text type="body" weight="semibold" hasTabularNumbers>
                {formatMoney(service.priceMinor, service.currency, tenant.locale)}
              </Text>
            </HStack>

            <HStack gap={2} isScrollable paddingBlock={1}>
              {(availability.data?.days ?? []).map((d) => {
                const date = new Date(`${d.date}T12:00:00Z`);
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
                      'flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-center',
                      active ? 'border-tenant-accent bg-tenant-accent text-white' : 'border-border bg-surface',
                      disabled && 'opacity-40',
                    )}
                  >
                    <Text type="supporting" color={active ? 'inherit' : 'secondary'}>
                      {formatZoned(date, 'EEE', tenant.timezone)}
                    </Text>
                    <Text type="large" weight="semibold" color="inherit" hasTabularNumbers>
                      {formatZoned(date, 'd', tenant.timezone)}
                    </Text>
                  </button>
                );
              })}
            </HStack>

            <VStack gap={1}>
              <Text type="supporting">Другая дата</Text>
              <label className="relative flex h-12 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
                <Text type="body" weight="medium" hasTabularNumbers>
                  {selectedDate ? formatZoned(new Date(`${selectedDate}T12:00:00Z`), 'd MMM yyyyг.', tenant.timezone) : ''}
                </Text>
                <input
                  type="date"
                  aria-label="Другая дата"
                  min={todayKey}
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setStartAt(null);
                    }
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </VStack>

            <AsyncBoundary
              isLoading={availability.isLoading}
              error={availability.error}
              onRetry={() => void availability.refetch()}
              isEmpty={!availability.isLoading && (day?.slots.length ?? 0) === 0}
              emptyTitle="На этот день свободных окон нет"
              emptyHint="Выберите другой день."
            >
              <HStack gap={2} wrap="wrap">
                {(day?.slots ?? []).map((slot) => {
                  const active = slot === startAt;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setStartAt(slot)}
                      className={cn(
                        'rounded-full border px-4 py-2',
                        active ? 'border-tenant-accent bg-tenant-accent text-white' : 'border-border bg-surface text-primary',
                      )}
                    >
                      <Text type="body" weight="medium" hasTabularNumbers>
                        {formatZoned(new Date(slot), 'HH:mm', tenant.timezone)}
                      </Text>
                    </button>
                  );
                })}
              </HStack>
            </AsyncBoundary>

            <Button
              label="Продолжить"
              variant="primary"
              width="100%"
              size="lg"
              isDisabled={!startAt}
              icon={<CaretRight size={18} />}
              onClick={() => setStep('contact')}
            />
          </VStack>
        ) : null}

        {step === 'contact' && service && startAt ? (
          <VStack gap={4}>
            <div className="rounded-2xl border border-border bg-surface p-3">
              <VStack gap={0}>
                <Text type="body" weight="semibold">
                  {formatZoned(new Date(startAt), 'd MMM, HH:mm', tenant.timezone)}
                </Text>
                <Text type="supporting">
                  {service.name} · {formatMoney(service.priceMinor, service.currency, tenant.locale)}
                </Text>
              </VStack>
            </div>
            <ContactForm value={customer} onChange={setCustomer} errors={errors} showErrors={showErrors} />
            <Button label="Автозаполнить контакты" variant="ghost" width="100%" onClick={autofill} />
            {createBooking.error ? (
              <Text type="supporting" role="alert">
                {createBooking.error instanceof ApiFailure ? createBooking.error.message : 'Не удалось создать запись. Попробуйте другое время.'}
              </Text>
            ) : null}
            <Button label="Проверить запись" variant="primary" width="100%" size="lg" onClick={toReview} />
          </VStack>
        ) : null}

        {step === 'review' && service && startAt && endAt ? (
          <VStack gap={4}>
            <div className="rounded-2xl border border-border bg-surface p-3">
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" hAlign="between">
                  <Text type="supporting">Услуга</Text>
                  <Text type="body" weight="semibold">
                    {service.name}
                  </Text>
                </HStack>
                <HStack gap={2} vAlign="center" hAlign="between">
                  <Text type="supporting">Заезд</Text>
                  <Text type="body" weight="medium">
                    {formatZoned(new Date(startAt), 'd MMMM в HH:mm', tenant.timezone)}
                  </Text>
                </HStack>
                <HStack gap={2} vAlign="center" hAlign="between">
                  <Text type="supporting">Выдача ориентировочно</Text>
                  <Text type="body" weight="medium">
                    {formatZoned(endAt, 'd MMMM в HH:mm', tenant.timezone)}
                  </Text>
                </HStack>
                <HStack gap={2} vAlign="center" hAlign="between">
                  <Text type="supporting">Стоимость</Text>
                  <Text type="body" weight="semibold">
                    {formatMoney(service.priceMinor, service.currency, tenant.locale)}
                  </Text>
                </HStack>
                <Divider />
                <HStack gap={2} vAlign="center" hAlign="between">
                  <Text type="supporting">Клиент</Text>
                  <VStack gap={0} hAlign="end">
                    <Text type="body">{customer.name}</Text>
                    <Text type="supporting">{customer.phone}</Text>
                    {customer.car ? <Text type="supporting">{customer.car}</Text> : null}
                  </VStack>
                </HStack>
                {tenant.address ? (
                  <HStack gap={2} vAlign="center" hAlign="between">
                    <Text type="supporting">Адрес</Text>
                    <Text type="body">{tenant.address}</Text>
                  </HStack>
                ) : null}
              </VStack>
            </div>
            <Text type="supporting">
              Отмена онлайн — не позднее чем за {tenant.cancelWindowMinutes} мин до заезда. Время студии: {tenant.timezone}.
            </Text>
            <button
              type="button"
              onClick={() => setConsent((v) => !v)}
              className="flex items-start gap-2 text-left"
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                  consent ? 'border-tenant-accent bg-tenant-accent text-white' : 'border-border bg-surface',
                )}
              >
                {consent ? '✓' : ''}
              </span>
              <Text type="supporting">
                Передать эти данные студии для оформления записи
              </Text>
            </button>
            {createBooking.error ? (
              <Text type="supporting" role="alert">
                {createBooking.error instanceof ApiFailure ? createBooking.error.message : 'Не удалось создать запись.'}
              </Text>
            ) : null}
            <Button
              label={createBooking.isPending ? 'Создаём запись…' : 'Подтвердить запись'}
              variant="primary"
              width="100%"
              size="lg"
              isDisabled={!consent}
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
            <div className="rounded-2xl border border-border bg-surface p-3">
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Clock size={16} className="text-tenant-accent" aria-hidden />
                  <Text type="body">
                    {formatZoned(new Date(confirmed.startAt), 'd MMM, HH:mm', tenant.timezone)}
                  </Text>
                </HStack>
                {confirmed.address ?? tenant.address ? (
                  <HStack gap={2} vAlign="center">
                    <MapPin size={16} className="text-tenant-accent" aria-hidden />
                    <Text type="body">{confirmed.address ?? tenant.address}</Text>
                  </HStack>
                ) : null}
                <Divider />
                <Text type="supporting">
                  {confirmed.serviceName} · {formatMoney(confirmed.priceMinor, confirmed.currency, tenant.locale)}
                </Text>
              </VStack>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <VStack gap={2}>
                <HStack gap={3} vAlign="center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-tenant-accent text-white">
                    <StarFour size={22} weight="fill" aria-hidden />
                  </span>
                  <VStack gap={0}>
                    <Text type="body" weight="semibold">
                      Студия всегда под рукой
                    </Text>
                    <Text type="supporting">Записывайтесь за несколько касаний, без поиска ссылки и звонков</Text>
                  </VStack>
                </HStack>
                <Button label="Добавить на экран" variant="primary" width="100%" href={tenantPath(slug, 'install')} />
                <Text type="supporting" justify="center">
                  Бесплатно. Установка через браузер.
                </Text>
              </VStack>
            </div>

            <VStack gap={2}>
              <Button label="Открыть мою запись" variant="primary" width="100%" onClick={() => void navigate(tenantPath(slug, `booking/${token ?? confirmed.id}`))} />
              <Button label="На главную" variant="secondary" width="100%" onClick={() => void navigate(tenantPath(slug))} />
            </VStack>
          </VStack>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}