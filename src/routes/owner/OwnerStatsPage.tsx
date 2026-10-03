import {useState} from 'react';
import {format, startOfMonth, endOfMonth} from 'date-fns';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Card} from '@astryxdesign/core/Card';
import {TextInput} from '@astryxdesign/core/TextInput';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {useOwnerStats} from '@/hooks/useOwner';
import {formatMoney} from '@/lib/money';

export function OwnerStatsPage() {
  const {slug, session} = useOwnerSession();
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const stats = useOwnerStats(slug, session, from, to);
  const data = stats.data?.stats;

  return (
    <VStack gap={4}>
      <Heading level={1}>Итоги</Heading>
      <HStack gap={2}>
        <TextInput label="С" value={from} onChange={setFrom} />
        <TextInput label="По" value={to} onChange={setTo} />
      </HStack>

      <AsyncBoundary isLoading={stats.isLoading} error={stats.error} onRetry={() => void stats.refetch()}>
        <VStack gap={2}>
          <Metric label="Заезды (принятые машины)" value={String(data?.arrivals ?? 0)} note="Сколько машин реально заехало за период" />
          <Metric label="Выполненные заказы" value={String(data?.completed ?? 0)} note="Работы со статусом «Готово»" />
          <Metric label="Отмены" value={String(data?.cancelled ?? 0)} note="Записи, отменённые за период" />
          <Metric label="Получено денег" value={formatMoney(data?.receivedMinor ?? 0, data?.currency ?? 'RUB')} note="Фактические платежи за период" />
          <Metric label="Возвраты" value={formatMoney(data?.refundedMinor ?? 0, data?.currency ?? 'RUB')} note="Возвращено клиентам" />
          <Metric
            label="Стоимость будущих записей"
            value={formatMoney(data?.upcomingMinor ?? 0, data?.currency ?? 'RUB')}
            note="Это не выручка: по предстоящим записям деньги ещё не получены"
          />
          <Text type="supporting">
            Период и часовой пояс ({stats.data?.stats.timezone ?? '—'}) совпадают с теми, что использует помощник.
          </Text>
        </VStack>
      </AsyncBoundary>
    </VStack>
  );
}

function Metric({label, value, note}: {label: string; value: string; note: string}) {
  return (
    <Card padding={3}>
      <VStack gap={0}>
        <Text type="supporting">{label}</Text>
        <Text type="body" weight="semibold" hasTabularNumbers>
          {value}
        </Text>
        <Text type="supporting">{note}</Text>
      </VStack>
    </Card>
  );
}
