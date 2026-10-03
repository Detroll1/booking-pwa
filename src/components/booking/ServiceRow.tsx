import {Link} from 'react-router-dom';
import {CaretRight} from '@phosphor-icons/react';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {formatMoney} from '@/lib/money';
import {tenantPath} from '@/lib/tenant/resolve';
import type {ApiService} from '@/types/api';

export function ServiceRow({slug, service, locale}: {slug: string; service: ApiService; locale: string}) {
  return (
    <Link
      to={`${tenantPath(slug, 'book')}?service=${service.id}`}
      className="block rounded-xl border border-border bg-surface p-3 transition-colors hover:border-tenant-accent"
    >
      <HStack gap={3} vAlign="center">
        <StackItem size="fill">
          <VStack gap={1}>
            <Text type="body" weight="medium">
              {service.name}
            </Text>
            {service.description ? <Text type="supporting">{service.description}</Text> : null}
            <Text type="supporting">
              {Math.round(service.durationMinutes)} мин
              {service.bufferAfterMinutes > 0 ? ` · подготовка ${service.bufferAfterMinutes} мин` : ''}
            </Text>
          </VStack>
        </StackItem>
        <VStack gap={1} hAlign="end">
          <Text type="body" weight="semibold">
            {formatMoney(service.priceMinor, service.currency, locale)}
          </Text>
          <HStack gap={1} vAlign="center" className="text-tenant-accent">
            <Text type="supporting" color="inherit">
              Записаться
            </Text>
            <CaretRight size={14} aria-hidden />
          </HStack>
        </VStack>
      </HStack>
    </Link>
  );
}
