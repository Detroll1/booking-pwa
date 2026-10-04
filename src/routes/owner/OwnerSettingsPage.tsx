import {useEffect, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {TextInput} from '@astryxdesign/core/TextInput';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {useCatalog} from '@/hooks/useTenant';
import {useUpdateTenant} from '@/hooks/useOwner';
import {ownerApi} from '@/lib/api/owner';

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function minToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function timeToMin(value: string): number {
  const [h = '0', m = '0'] = value.split(':');
  return Number(h) * 60 + Number(m);
}

export function OwnerSettingsPage() {
  const {slug, session} = useOwnerSession();
  const catalog = useCatalog(slug);
  const updateTenant = useUpdateTenant(slug, session);
  const client = useQueryClient();
  const hoursQuery = useQuery({
    queryKey: ['owner', 'hours', slug],
    queryFn: () => ownerApi.hours(session.access_token, slug),
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<{weekday: number; windows: {startMin: number; endMin: number}[]}[]>([]);
  const [cards, setCards] = useState<{title: string; body: string; icon: string | null}[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (catalog.data?.tenant) {
      const t = catalog.data.tenant;
      setDraft({
        name: t.name ?? '',
        tagline: t.tagline ?? '',
        description: t.description ?? '',
        phone: t.phone ?? '',
        address: t.address ?? '',
        mapUrl: t.mapUrl ?? '',
        accent: t.accent ?? '',
        timezone: t.timezone ?? 'UTC',
        currency: t.currency ?? 'RUB',
        bookingLeadMinutes: String(t.bookingLeadMinutes ?? 0),
        cancelWindowMinutes: String(t.cancelWindowMinutes ?? 0),
        slotStepMinutes: String(t.slotStepMinutes ?? 30),
        heroImageUrl: t.heroImageUrl ?? '',
        logoUrl: t.logoUrl ?? '',
      });
    }
  }, [catalog.data]);

  useEffect(() => {
    if (hoursQuery.data?.hours) setHours(hoursQuery.data.hours);
  }, [hoursQuery.data]);

  useEffect(() => {
    if (catalog.data?.tenant.infoCards) {
      setCards(catalog.data.tenant.infoCards.map((c) => ({title: c.title, body: c.body, icon: c.icon})));
    }
  }, [catalog.data]);

  function saveCards() {
    void ownerApi
      .setCards(session.access_token, slug, cards.filter((c) => c.title.trim()))
      .then(() => client.invalidateQueries({queryKey: ['catalog', slug]}))
      .then(() => setSaved(true));
  }

  function save() {
    updateTenant.mutate(
      {
        name: draft.name,
        tagline: draft.tagline,
        description: draft.description,
        phone: draft.phone,
        address: draft.address,
        mapUrl: draft.mapUrl,
        accent: draft.accent,
        timezone: draft.timezone,
        currency: draft.currency,
        bookingLeadMinutes: Number(draft.bookingLeadMinutes) || 0,
        cancelWindowMinutes: Number(draft.cancelWindowMinutes) || 0,
        slotStepMinutes: Number(draft.slotStepMinutes) || 30,
        heroImageUrl: draft.heroImageUrl,
        logoUrl: draft.logoUrl,
      },
      {onSuccess: () => setSaved(true)},
    );
  }

  function saveHours() {
    void ownerApi
      .setHours(session.access_token, slug, hours)
      .then(() => client.invalidateQueries({queryKey: ['owner', 'hours', slug]}))
      .then(() => setSaved(true));
  }

  return (
    <VStack gap={4}>
      <Heading level={1}>Настройки студии</Heading>
      <AsyncBoundary isLoading={catalog.isLoading} error={catalog.error} onRetry={() => void catalog.refetch()}>
        <Card padding={4}>
          <VStack gap={3}>
            <TextInput label="Название" value={draft.name ?? ''} onChange={(v) => setDraft({...draft, name: v})} isRequired />
            <TextInput label="Коротко о студии" value={draft.tagline ?? ''} onChange={(v) => setDraft({...draft, tagline: v})} />
            <TextInput label="Описание" value={draft.description ?? ''} onChange={(v) => setDraft({...draft, description: v})} />
            <TextInput label="Телефон" value={draft.phone ?? ''} onChange={(v) => setDraft({...draft, phone: v})} />
            <TextInput label="Адрес" value={draft.address ?? ''} onChange={(v) => setDraft({...draft, address: v})} />
            <TextInput label="Ссылка на карту" value={draft.mapUrl ?? ''} onChange={(v) => setDraft({...draft, mapUrl: v})} />
            <TextInput label="Акцент (#HEX)" value={draft.accent ?? ''} onChange={(v) => setDraft({...draft, accent: v})} />
            <TextInput label="Часовой пояс (IANA)" value={draft.timezone ?? ''} onChange={(v) => setDraft({...draft, timezone: v})} />
            <TextInput label="Валюта" value={draft.currency ?? ''} onChange={(v) => setDraft({...draft, currency: v})} />
            <TextInput label="Шаг слотов, мин" value={draft.slotStepMinutes ?? ''} onChange={(v) => setDraft({...draft, slotStepMinutes: v})} />
            <TextInput label="Запас до визита, мин" value={draft.bookingLeadMinutes ?? ''} onChange={(v) => setDraft({...draft, bookingLeadMinutes: v})} />
            <TextInput label="Окно отмены, мин" value={draft.cancelWindowMinutes ?? ''} onChange={(v) => setDraft({...draft, cancelWindowMinutes: v})} />
            <TextInput label="Главное фото (URL)" value={draft.heroImageUrl ?? ''} onChange={(v) => setDraft({...draft, heroImageUrl: v})} />
            <TextInput label="Логотип (URL)" value={draft.logoUrl ?? ''} onChange={(v) => setDraft({...draft, logoUrl: v})} />
            <Button label={updateTenant.isPending ? 'Сохраняем…' : 'Сохранить'} variant="primary" isLoading={updateTenant.isPending} onClick={save} />
          </VStack>
        </Card>
      </AsyncBoundary>

      <Divider />

      <VStack gap={3}>
        <Heading level={2}>Часы работы</Heading>
        <Text type="supporting">Простое окно приёма на каждый день недели. Пустое значение — выходной.</Text>
        {WEEKDAYS.map((label, weekday) => {
          const window = hours.find((h) => h.weekday === weekday)?.windows[0];
          const closed = !window;
          return (
            <HStack key={label} gap={2} vAlign="end">
              <Text type="supporting" className="w-8 shrink-0">
                {label}
              </Text>
              <TextInput
                label="Открытие"
                isLabelHidden
                value={closed ? '' : minToTime(window.startMin)}
                onChange={(v) => {
                  const next = hours.filter((h) => h.weekday !== weekday);
                  next.push({weekday, windows: [{startMin: timeToMin(v), endMin: window?.endMin ?? 20 * 60}]});
                  setHours(next);
                }}
              />
              <TextInput
                label="Закрытие"
                isLabelHidden
                value={closed ? '' : minToTime(window.endMin)}
                onChange={(v) => {
                  const next = hours.filter((h) => h.weekday !== weekday);
                  next.push({weekday, windows: [{startMin: window?.startMin ?? 10 * 60, endMin: timeToMin(v)}]});
                  setHours(next);
                }}
              />
              <Button
                label={closed ? 'Выходной' : 'Рабочий'}
                variant={closed ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => {
                  const next = hours.filter((h) => h.weekday !== weekday);
                  if (closed) next.push({weekday, windows: [{startMin: 10 * 60, endMin: 20 * 60}]});
                  setHours(next);
                }}
              />
            </HStack>
          );
        })}
        <Button label="Сохранить часы" variant="secondary" onClick={saveHours} />
      </VStack>

      <Divider />

      <VStack gap={3}>
        <Heading level={2}>Карточки витрины</Heading>
        <Text type="supporting">Три информационные карточки на главной странице.</Text>
        <VStack gap={3}>
          {cards.map((card, index) => (
            <div key={index} className="rounded-2xl border border-border bg-surface p-3">
              <VStack gap={2}>
                <TextInput label="Заголовок" value={card.title} onChange={(v) => setCards((prev) => prev.map((c, i) => (i === index ? {...c, title: v} : c)))} />
                <TextInput label="Текст" value={card.body} onChange={(v) => setCards((prev) => prev.map((c, i) => (i === index ? {...c, body: v} : c)))} />
                <TextInput label="Иконка" value={card.icon ?? ''} onChange={(v) => setCards((prev) => prev.map((c, i) => (i === index ? {...c, icon: v} : c)))} />
              </VStack>
            </div>
          ))}
        </VStack>
        <Button label="Сохранить карточки" variant="secondary" onClick={saveCards} />
      </VStack>

      {saved ? <Text type="supporting">Сохранено.</Text> : null}
    </VStack>
  );
}
