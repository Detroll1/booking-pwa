import {useParams} from 'react-router-dom';
import {VStack} from '@astryxdesign/core/VStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {useTenantContext} from '@/app/TenantContext';
import {ServiceRow} from '@/components/booking/ServiceRow';
import {AsyncBoundary} from '@/components/AsyncBoundary';

export function TenantServicesPage() {
  const {tenant, services} = useTenantContext();
  const {slug = ''} = useParams();

  return (
    <VStack gap={4} padding={4} paddingBlockEnd={8}>
      <VStack gap={1}>
        <Heading level={1}>Услуги и цены</Heading>
        <Text type="supporting">
          Цены и длительность указаны студией. Выберите услугу, чтобы увидеть свободное время.
        </Text>
      </VStack>
      <AsyncBoundary isEmpty={services.length === 0} emptyTitle="Услуги пока не добавлены">
        <VStack gap={2}>
          {services.map((service) => (
            <ServiceRow key={service.id} slug={slug} service={service} locale={tenant.locale} />
          ))}
        </VStack>
      </AsyncBoundary>
    </VStack>
  );
}
