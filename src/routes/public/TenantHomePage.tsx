import {useParams} from 'react-router-dom';
import {Link} from 'react-router-dom';
import {Car, Clock, MapPin, Phone, ShieldCheck, Sparkle, Star, Wrench, Tag} from '@phosphor-icons/react';
import type {Icon} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {useTenantContext} from '@/app/TenantContext';
import {ServiceRow} from '@/components/booking/ServiceRow';
import {WorkGallery} from '@/components/booking/WorkGallery';
import {AssistantSheet} from '@/components/assistant/AssistantSheet';
import {Reveal} from '@/components/layout/Reveal';
import {TenantHeader} from '@/components/layout/TenantHeader';
import {formatMoney} from '@/lib/money';
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
  const minPrice = Number.isFinite(tenant.minPriceMinor)
    ? formatMoney(tenant.minPriceMinor, tenant.currency, tenant.locale)
    : null;

  return (
    <>
      <TenantHeader />

      <section className="hero hero-grad relative flex min-h-[46vh] flex-col justify-end">
        <Link
          to={tenantPath(slug, 'book')}
          className="glass relative z-10 mx-4 mb-5 flex items-center justify-between rounded-2xl px-4 py-3 text-primary transition-colors hover:border-tenant-accent"
        >
          <Text type="body" weight="semibold">
            Записаться
          </Text>
          <span aria-hidden className="text-tenant-accent">
            ↗
          </span>
        </Link>
      </section>

      <VStack gap={6} paddingInline={4} paddingBlockEnd={8}>
        <VStack gap={2}>
          <Heading level={1} type="display-2">
            {tenant.name}
          </Heading>
          {tenant.tagline ? (
            <Text type="large" color="secondary">
              {tenant.tagline}
            </Text>
          ) : null}
        </VStack>

        <HStack gap={2} wrap="wrap">
          <StatChip icon={Wrench} value={String(tenant.serviceCount)} label="услуг в прайсе" />
          <StatChip icon={Car} value={String(tenant.resourceCount)} label="бокса в работе" />
          {minPrice ? <StatChip icon={Tag} value={`от ${minPrice}`} label="за услугу" wide /> : null}
        </HStack>

        {tenant.description ? (
          <Reveal>
            <Text type="body" color="secondary">
              {tenant.description}
            </Text>
          </Reveal>
        ) : null}

        <Reveal>
          <VStack gap={3}>
            <Heading level={2}>Запись в студию</Heading>
            <HStack gap={3} vAlign="center" className="rounded-2xl border border-border bg-surface p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl tenant-accent-soft text-tenant-accent">
                <Sparkle size={20} weight="fill" aria-hidden />
              </span>
              <VStack gap={0}>
                <Text type="body" weight="semibold">
                  Свежий вид для вашего авто
                </Text>
                <Text type="supporting">Выберите услугу и удобное время — остальное возьмём на себя</Text>
              </VStack>
            </HStack>
            <AssistantSheet slug={slug} scope="client" />
          </VStack>
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
                  <HStack key={card.id} gap={3} vAlign="start" className="rounded-2xl border border-border bg-surface p-3">
                    <CardIcon size={22} className="text-tenant-accent" aria-hidden />
                    <VStack gap={0}>
                      <Text type="body" weight="semibold">
                        {card.title}
                      </Text>
                      <Text type="supporting">{card.body}</Text>
                    </VStack>
                  </HStack>
                );
              })}
            </VStack>
          </Reveal>
        ) : null}

        <Reveal>
          <VStack gap={3}>
            <Heading level={2}>Как найти и когда работаем</Heading>
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
          <Link
            to={tenantPath(slug, 'book')}
            className="flex w-full items-center justify-center rounded-2xl border border-border bg-surface px-4 py-3 text-primary transition-colors hover:border-tenant-accent"
          >
            <Text type="body" weight="semibold">
              Записаться
            </Text>
          </Link>
        </Reveal>
      </VStack>
    </>
  );
}

function StatChip({
  icon: ChipIcon,
  value,
  label,
  wide = false,
}: {
  icon: Icon;
  value: string;
  label: string;
  wide?: boolean;
}) {
  return (
    <HStack
      gap={2}
      vAlign="center"
      className={`rounded-2xl border border-border bg-surface px-3 py-2 ${wide ? 'flex-1' : ''}`}
    >
      <ChipIcon size={18} className="text-tenant-accent" aria-hidden />
      <VStack gap={0}>
        <Text type="body" weight="semibold" hasTabularNumbers>
          {value}
        </Text>
        <Text type="supporting">{label}</Text>
      </VStack>
      <StackItem size="static" />
    </HStack>
  );
}
