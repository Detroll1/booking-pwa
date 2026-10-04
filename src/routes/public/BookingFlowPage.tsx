import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {ArrowLeft, CaretRight, CheckCircle, Clock, MapPin, Sparkle, StarFour} from '@phosphor-icons/react';
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

  function back() {
    if (step === 'review') setStep('contact');
    else if (step === 'contact') setStep('time');
    else if (step === 'time') setStep('service');
    else if (step === 'service') setStep('intro');
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

  const showBack = step !== 'intro' && step !== 'success';
  const titles: Partial<Record<Step, string>> = {
    service: 'Выбери услугу',
    time: 'Дата и время',
    contact: 'Ваши данные',
    review: 'Проверьте запись',
  };

  return (
    <Drawer open onOpenChange={(open) => !open && close()} modal swipeDirection="down">
      <DrawerContent>
        <DrawerHeader>
          <HStack gap={2} vAlign="center" hAlign="between">
            <HStack gap={2} vAlign="center">
              {showBack ? (
                <Button label="Назад" variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={back} />
              ) : null}
              <Heading level={2}>{titles[step] ?? 'Запись в студию'}</Heading>
            </HStack>
            <DrawerClose className="rounded-md px-2 py-1 text-sm text-secondary hover:text-primary">Закрыть</DrawerClose>
          </HStack>
          <DrawerTitle className="sr-only">Оформление записи</DrawerTitle>
          <DrawerDescription className="sr-only">Выберите услугу, время и оставьте контакты</DrawerDescription>
        </DrawerHeader>

        {step === 'intro' ? (
          <VStack gap={4}>
            <HStack gap={3} vAlign="center" className="rounded-2xl border border-border bg-surface p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl tenant-accent-soft text-tenant-accent">
                <Sparkle size={24} weight="fill" aria-hidden />
              </span>
              <VStack gap={1}>
                <Text type="body" weight="semibold">
                  Свежий вид для вашего авто
                </Text>
                <Text type="supporting">Выберем услугу и удобное время — остальное возьмём на себя</Text>
              </VStack>
            </HStack>
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
                  <HStack gap={2} vAlign="center" hAlign="between">
                    <VStack gap={1}>
                      <Text type="body" weight="semibold">
                        {s.name}
                      </Text>
                      <Text type="supporting">{s.durationMinutes} мин</Text>
                    </VStack>
                    <VStack gap={1} hAlign="end">
                      <Text type="body" weight="semibold">
                        {formatMoney(s.priceMinor, s.currency, tenant.locale)}
                      </Text>
                      <Button label="Выбрать" variant="secondary" size="sm" onClick={() => chooseService(s.id)} />
                    </VStack>
                  </HStack>
                </div>
              ))
            )}
          </VStack>
        ) : null}

        {step === 'time' && service ? (
          <VStack gap={4}>
            <div className="rounded-2xl border border-border bg-surface p-3">
              <HStack gap={2} vAlign="center" hAlign="between">
                <VStack gap={0}>
                  <Text type="body" weight="semibold">
                    {service.name}
                  </Text>
                  <Text type="supporting">{formatMoney(service.priceMinor, service.currency, tenant.locale)}</Text>
                </VStack>
                <Button label="Сменить" variant="ghost" size="sm" onClick={() => setStep('service')} />
              </HStack>
            </div>

            <HStack gap={2} isScrollable>
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
                      'shrink-0 rounded-xl border px-2 py-2 text-center',
                      active ? 'border-tenant-accent tenant-accent-soft' : 'border-border bg-surface',
                      disabled && 'opacity-40',
                    )}
                  >
                    <Text type="supporting" color={active ? 'inherit' : 'secondary'}>
                      {formatZoned(date, 'EEE', tenant.timezone)}
                    </Text>
                    <Text type="body" weight={active ? 'semibold' : 'medium'} hasTabularNumbers>
                      {formatZoned(date, 'd', tenant.timezone)}
                    </Text>
                  </button>
                );
              })}
            </HStack>

            <HStack gap={2} vAlign="center" hAlign="between">
              <VStack gap={0}>
                <Text type="supporting">Другая дата</Text>
                <Text type="body" weight="semibold" hasTabularNumbers>
                  {selectedDate ? formatZoned(new Date(`${selectedDate}T12:00:00Z`), 'd MMM yyyy', tenant.timezone) : ''}
                </Text>
              </VStack>
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
                className="rounded-xl border border-border bg-surface px-3 py-2 text-primary"
              />
            </HStack>

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
                    {formatZoned(new Date(startAt), 'd MMM, HH:mm', tenant.timezone)}
                  </Text>
                </HStack>
                <HStack gap={2} vAlign="center" hAlign="between">
                  <Text type="supporting">Выдача ориентировочно</Text>
                  <Text type="body" weight="medium">
                    {formatZoned(endAt, 'd MMM, HH:mm', tenant.timezone)}
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
              Отмена — не позже чем за {tenant.cancelWindowMinutes} мин до заезда. Время студии: {tenant.timezone}.
            </Text>
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

            <HStack gap={3} vAlign="center" className="rounded-2xl border border-border bg-surface p-3">
              <StarFour size={22} className="text-tenant-accent" aria-hidden />
              <VStack gap={0}>
                <Text type="body" weight="semibold">
                  Добавить на экран
                </Text>
                <Text type="supporting">Студия всегда под рукой — иконка и быстрый доступ</Text>
              </VStack>
            </HStack>

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