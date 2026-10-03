import {useParams} from 'react-router-dom';
import {Link} from 'react-router-dom';
import {Clock, MapPin, Phone, ShieldCheck, Sparkle, Star} from '@phosphor-icons/react';
import type {Icon} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Section} from '@astryxdesign/core/Section';
import {Divider} from '@astryxdesign/core/Divider';
import {useTenantContext} from '@/app/TenantContext';
import {ServiceRow} from '@/components/booking/ServiceRow';
import {WorkGallery} from '@/components/booking/WorkGallery';
import {AssistantSheet} from '@/components/assistant/AssistantSheet';
import {Reveal} from '@/components/layout/Reveal';
import {tenantPath} from '@/lib/tenant/resolve';

const CARD_ICONS: Record<string, Icon> = {
  sparkle: Sparkle,
  shield: ShieldCheck,
  star: Star,
  clock: Clock,
  phone: Phone,
  pin: MapPin,
};

export function TenantHomePage() {
  const {tenant, services, works} = useTenantContext();
  const {slug = ''} = useParams();
  const previewServices = services.slice(0, 4);

  return (
    <>
      <section className="hero hero-grad flex min-h-[58vh] flex-col justify-end">
        <VStack gap={4} padding={4} paddingBlockEnd={6} className="relative z-10">
          <VStack gap={2}>
            <HStack gap={2} vAlign="center">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt="" className="h-10 w-10 rounded-full border border-border object-cover" />
              ) : null}
              <Heading level={1}>{tenant.name}</Heading>
            </HStack>
            {tenant.tagline ? (
              <Text type="large" color="secondary">
                {tenant.tagline}
              </Text>
            ) : null}
          </VStack>
          <VStack gap={2}>
            <Heading level={2}>Запись в студию</Heading>
            <Button
              label="Записаться"
              variant="primary"
              size="lg"
              width="100%"
              href={tenantPath(slug, 'book')}
            />
          </VStack>
        </VStack>
      </section>

      <VStack gap={6} padding={4} paddingBlockEnd={8}>
        {tenant.description ? (
          <Reveal>
            <Section variant="transparent" padding={0}>
              <Text type="body" color="secondary">
                {tenant.description}
              </Text>
            </Section>
          </Reveal>
        ) : null}

        <Reveal>
          <HStack gap={2} vAlign="center" hAlign="between">
            <Text type="supporting">Есть вопрос? Помощник ответит по свободному времени и ценам.</Text>
            <AssistantSheet slug={slug} scope="client" />
          </HStack>
        </Reveal>

        <Reveal>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center" hAlign="between">
              <Heading level={2}>Услуги</Heading>
              <Link to={tenantPath(slug, 'services')} className="text-tenant-accent">
                <Text type="supporting" color="inherit">
                  Все услуги
                </Text>
              </Link>
            </HStack>
            <VStack gap={2}>
              {previewServices.map((service) => (
                <ServiceRow key={service.id} slug={slug} service={service} locale={tenant.locale} />
              ))}
            </VStack>
          </VStack>
        </Reveal>

        {works.length > 0 ? (
          <Reveal>
            <VStack gap={3}>
              <Heading level={2}>Наши работы</Heading>
              <WorkGallery works={works} />
            </VStack>
          </Reveal>
        ) : null}

        {tenant.infoCards.length > 0 ? (
          <Reveal>
            <VStack gap={3}>
              {tenant.infoCards.map((card) => {
                const CardIcon = CARD_ICONS[card.icon ?? 'sparkle'] ?? Sparkle;
                return (
                  <Card key={card.id}>
                    <HStack gap={3} vAlign="start">
                      <CardIcon size={22} className="text-tenant-accent" aria-hidden />
                      <VStack gap={1}>
                        <Text type="body" weight="semibold">
                          {card.title}
                        </Text>
                        <Text type="supporting">{card.body}</Text>
                      </VStack>
                    </HStack>
                  </Card>
                );
              })}
            </VStack>
          </Reveal>
        ) : null}

        <Reveal>
          <VStack gap={3}>
            <Heading level={2}>Как найти и когда работаем</Heading>
            <Divider />
            <VStack gap={2}>
              {tenant.address ? (
                <HStack gap={2} vAlign="center">
                  <MapPin size={18} className="text-tenant-accent" aria-hidden />
                  {tenant.mapUrl ? (
                    <a href={tenant.mapUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                      <Text type="body">{tenant.address}</Text>
                    </a>
                  ) : (
                    <Text type="body">{tenant.address}</Text>
                  )}
                </HStack>
              ) : null}
              {tenant.phone ? (
                <HStack gap={2} vAlign="center">
                  <Phone size={18} className="text-tenant-accent" aria-hidden />
                  <a href={`tel:${tenant.phone}`} className="text-primary underline">
                    <Text type="body">{tenant.phone}</Text>
                  </a>
                </HStack>
              ) : null}
              {tenant.hoursSummary.length > 0 ? (
                <HStack gap={2} vAlign="start">
                  <Clock size={18} className="text-tenant-accent" aria-hidden />
                  <VStack gap={0}>
                    {tenant.hoursSummary.map((line) => (
                      <Text key={line} type="body">
                        {line}
                      </Text>
                    ))}
                  </VStack>
                </HStack>
              ) : null}
            </VStack>
          </VStack>
        </Reveal>

        <Reveal>
          <HStack gap={2} hAlign="center">
            <StackItem size="fill">
              <Button label="Записаться" variant="secondary" width="100%" href={tenantPath(slug, 'book')} />
            </StackItem>
          </HStack>
        </Reveal>
      </VStack>
    </>
  );
}
