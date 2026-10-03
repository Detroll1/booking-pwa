import {useState} from 'react';
import {Plus, PencilSimple, Trash} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose} from '@/components/ui/drawer';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {useOwnerServices, useOwnerResources} from '@/hooks/useOwner';
import {ownerApi, type OwnerService} from '@/lib/api/owner';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {formatMoney, parseMoneyToMinor} from '@/lib/money';

export function OwnerServicesPage() {
  const {slug, session} = useOwnerSession();
  const services = useOwnerServices(slug, session);
  const resources = useOwnerResources(slug, session);
  const client = useQueryClient();
  const [editing, setEditing] = useState<Partial<OwnerService> | null>(null);

  const upsert = useMutation({
    mutationFn: (service: Partial<OwnerService> & {id?: string}) => ownerApi.upsertService(session.access_token, slug, service),
    onSuccess: () => void client.invalidateQueries({queryKey: ['owner', 'services', slug]}),
  });
  const remove = useMutation({
    mutationFn: (id: string) => ownerApi.deleteService(session.access_token, slug, id),
    onSuccess: () => void client.invalidateQueries({queryKey: ['owner', 'services', slug]}),
  });

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center">
        <Heading level={1}>Услуги</Heading>
        <Button
          label="Добавить"
          variant="primary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => setEditing({name: '', priceMinor: 0, durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, isActive: true})}
        />
      </HStack>

      <AsyncBoundary
        isLoading={services.isLoading}
        error={services.error}
        onRetry={() => void services.refetch()}
        isEmpty={(services.data?.services.length ?? 0) === 0}
        emptyTitle="Услуг пока нет"
      >
        <VStack gap={2}>
          {(services.data?.services ?? []).map((service) => (
            <Card key={service.id} padding={3}>
              <HStack hAlign="between" vAlign="center" gap={2}>
                <VStack gap={0}>
                  <Text type="body" weight="semibold">
                    {service.name} {service.isActive ? '' : '(скрыта)'}
                  </Text>
                  <Text type="supporting">
                    {formatMoney(service.priceMinor, 'RUB')} · {service.durationMinutes} мин · буфер {service.bufferAfterMinutes} мин
                  </Text>
                </VStack>
                <HStack gap={1}>
                  <Button label="Изменить" variant="ghost" size="sm" icon={<PencilSimple size={16} />} onClick={() => setEditing(service)} />
                  <Button label="Удалить" variant="ghost" size="sm" icon={<Trash size={16} />} isLoading={remove.isPending} onClick={() => remove.mutate(service.id)} />
                </HStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      </AsyncBoundary>

      <Text type="supporting">
        Ресурсы для планирования: {(resources.data?.resources ?? []).map((r) => r.name).join(', ') || 'не заданы'}
      </Text>

      <Drawer open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} swipeDirection="down">
        <DrawerContent>
          <DrawerHeader>
            <HStack hAlign="between" vAlign="center">
              <DrawerTitle>{editing?.id ? 'Изменить услугу' : 'Новая услуга'}</DrawerTitle>
              <DrawerClose className="rounded-md px-2 py-1 text-sm text-secondary hover:text-primary">Закрыть</DrawerClose>
            </HStack>
          </DrawerHeader>
          {editing ? (
            <ServiceForm
              value={editing}
              onChange={setEditing}
              onSubmit={() => {
                if (!editing.name) return;
                upsert.mutate(editing, {onSuccess: () => setEditing(null)});
              }}
              pending={upsert.isPending}
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    </VStack>
  );
}

function ServiceForm({
  value,
  onChange,
  onSubmit,
  pending,
}: {
  value: Partial<OwnerService>;
  onChange: (next: Partial<OwnerService>) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const [price, setPrice] = useState(value.priceMinor ? String(value.priceMinor / 100) : '');
  return (
    <VStack gap={3}>
      <TextInput label="Название" value={value.name ?? ''} onChange={(name) => onChange({...value, name})} isRequired />
      <TextInput label="Описание" value={value.description ?? ''} onChange={(description) => onChange({...value, description})} />
      <TextInput label="Цена, ₽" value={price} onChange={(next) => {setPrice(next); onChange({...value, priceMinor: parseMoneyToMinor(next) ?? 0});}} isRequired />
      <TextInput label="Длительность, мин" value={String(value.durationMinutes ?? 60)} onChange={(next) => onChange({...value, durationMinutes: Number(next) || 0})} isRequired />
      <TextInput label="Подготовка до, мин" value={String(value.bufferBeforeMinutes ?? 0)} onChange={(next) => onChange({...value, bufferBeforeMinutes: Number(next) || 0})} />
      <TextInput label="Подготовка после, мин" value={String(value.bufferAfterMinutes ?? 0)} onChange={(next) => onChange({...value, bufferAfterMinutes: Number(next) || 0})} />
      <TextInput label="Тип ресурса" placeholder="например, bay" value={value.resourceKind ?? ''} onChange={(next) => onChange({...value, resourceKind: next})} />
      <HStack gap={2}>
        <Button label={value.isActive ? 'Видима' : 'Скрыта'} variant={value.isActive ? 'primary' : 'secondary'} size="sm" onClick={() => onChange({...value, isActive: !value.isActive})} />
      </HStack>
      <Button label={pending ? 'Сохраняем…' : 'Сохранить'} variant="primary" width="100%" isLoading={pending} onClick={onSubmit} />
    </VStack>
  );
}
